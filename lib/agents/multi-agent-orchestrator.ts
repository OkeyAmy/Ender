import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import { commandLogBus, CommandLogEvent } from '@/lib/sandbox/telemetry/command-log-bus';
import { environmentValidator } from '@/lib/sandbox/validation/environment-validator';
import { buildErrorHandler } from '@/lib/sandbox/recovery/build-error-handler';

export interface BuildAgentOutput {
  summary: string;
  actionPlan: string[];
}

export interface OrchestratorDecision {
  readyForUser: boolean;
  reasoning: string;
  followUps: string[];
}

function formatLogs(logs: CommandLogEvent[]): string {
  return logs
    .map(log => {
      const status = log.success ? 'ok' : 'fail';
      const duration = log.durationMs ? ` (${log.durationMs}ms)` : '';
      const stderr = log.stderr?.trim() ? `\nstderr: ${log.stderr.trim()}` : '';
      return `- ${status}: ${log.command}${duration}\nstdout: ${log.stdout?.trim() || '∅'}${stderr}`;
    })
    .join('\n\n');
}

/**
 * Creates a LangChain runnable that acts as the build agent.
 * It reads recent command logs and proposes concrete actions.
 */
export function createBuildAgent(model: BaseChatModel) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are the build agent. Given recent sandbox command logs, identify failures, missing deps, and propose explicit next commands to repair them. Output bullet points.'
    ],
    ['human', 'Logs:\n{logs}\n\nValidation summary:\n{validation}\n\nRespond with a short summary and a numbered action plan.']
  ]);

  return RunnableSequence.from([
    RunnableLambda.from(async (_input: { logs: CommandLogEvent[] }) => {
      const validation = await environmentValidator.validate({ skipBuildCheck: true });
      const logText = formatLogs(_input.logs || []);
      const validationText = validation.valid
        ? 'Environment is healthy.'
        : validation.errors.map(e => `${e.type}: ${e.message}`).join('\n');

      return { logs: logText, validation: validationText };
    }),
    prompt,
    model,
    RunnableLambda.from((message: AIMessage): BuildAgentOutput => {
      return {
        summary: message.content.toString(),
        actionPlan: message.content
          .toString()
          .split('\n')
          .filter(line => line.trim().match(/^\d+/))
      };
    })
  ]);
}

/**
 * Orchestrator agent that reviews build agent output and decides if the build is healthy.
 */
export function createOrchestratorAgent(model: BaseChatModel) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      'You are the release gatekeeper. If any unresolved issues remain, request remediation. Approve only when lint/build are clean and validation is green.'
    ],
    [
      'human',
      'Recent logs:\n{logs}\n\nBuild agent summary:\n{buildSummary}\n\nOpen issues:\n{issues}\n\nShould we proceed? Provide ready:true/false and follow-up steps.'
    ]
  ]);

  return RunnableSequence.from([
    RunnableLambda.from(async (input: { logs: CommandLogEvent[]; buildSummary: string }) => {
      const detected = buildErrorHandler.detectErrors(formatLogs(input.logs));
      const issues = detected.length ? buildErrorHandler.formatErrorsForAI(detected) : 'None detected.';

      return {
        logs: formatLogs(input.logs),
        buildSummary: input.buildSummary,
        issues
      };
    }),
    prompt,
    model,
    RunnableLambda.from((message: AIMessage): OrchestratorDecision => {
      const content = message.content.toString();
      const readyForUser = /ready:\s*true/i.test(content) || /ready for user/i.test(content);
      const followUps = content
        .split('\n')
        .filter(line => line.trim().match(/^\d+|\-/))
        .map(line => line.replace(/^\s*[-\d\.\)]+\s*/, '').trim());

      return {
        readyForUser,
        reasoning: content,
        followUps
      };
    })
  ]);
}

/**
 * Convenience helper to run the multi-agent stack over the latest logs.
 */
export async function runMultiAgentCycle(model: BaseChatModel): Promise<{ buildResult: BuildAgentOutput; decision: OrchestratorDecision }> {
  const logs = commandLogBus.getRecent(25);
  const buildAgent = createBuildAgent(model);
  const buildResult = await buildAgent.invoke({ logs });

  const orchestratorAgent = createOrchestratorAgent(model);
  const decision = await orchestratorAgent.invoke({
    logs,
    buildSummary: buildResult.summary
  });

  return { buildResult, decision };
}
