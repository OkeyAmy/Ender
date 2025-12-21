/**
 * Orchestrator Agent
 * Coordinates multi-agent workflow and makes high-level decisions
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { BaseAgent, AgentConfig, AgentContext, AgentInput, AgentOutput } from './base-agent';
import { CurrentDevState } from '../state/types';

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator Agent - the central coordinator of a multi-agent code generation system.

## Your Role
You coordinate between specialized agents to deliver high-quality, working code:
- **CodeGen Agent**: Generates code files based on blueprints and phases
- **Build Agent**: Monitors build status and proposes fixes
- **Debug Agent**: Investigates and fixes runtime errors
- **Review Agent**: Reviews code quality and suggests improvements

## Your Responsibilities
1. **Analyze User Requests**: Understand what the user wants and determine the best approach
2. **Delegate Tasks**: Route work to the appropriate specialized agent
3. **Monitor Progress**: Track phase completion and overall project status
4. **Make Decisions**: Decide when to proceed, retry, or escalate
5. **Quality Gate**: Only approve delivery when everything is verified working

## Decision Framework
When receiving updates, evaluate:
- Are all phases complete?
- Are there any unresolved errors?
- Has the build been verified?
- Is the code ready for user review?

## Output Format
Respond with a JSON object:
{
  "decision": "proceed" | "delegate" | "retry" | "complete" | "escalate",
  "reasoning": "Brief explanation of your decision",
  "targetAgent": "codegen" | "build" | "debug" | "review" | null,
  "instructions": "Specific instructions for the target agent",
  "readyForUser": boolean,
  "followUpActions": ["action1", "action2"]
}

## Guidelines
- Be decisive and action-oriented
- Prefer fixing issues automatically over asking users
- Only escalate when genuinely stuck after multiple attempts
- Keep user-facing messages concise and professional`;

export interface OrchestratorDecision {
  decision: 'proceed' | 'delegate' | 'retry' | 'complete' | 'escalate';
  reasoning: string;
  targetAgent: 'codegen' | 'build' | 'debug' | 'review' | null;
  instructions: string;
  readyForUser: boolean;
  followUpActions: string[];
}

export interface OrchestratorInput extends AgentInput {
  context: {
    currentState: CurrentDevState;
    phaseProgress: { completed: number; total: number };
    recentErrors: string[];
    buildStatus: 'success' | 'failed' | 'unknown';
    lastAgentOutput?: string;
  };
}

/**
 * OrchestratorAgent - Coordinates the multi-agent system
 */
export class OrchestratorAgent extends BaseAgent {
  constructor(context: AgentContext) {
    const config: AgentConfig = {
      name: 'OrchestratorAgent',
      description: 'Coordinates multi-agent workflow and makes high-level decisions',
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
      maxIterations: 5,
    };
    super(config, context);
  }

  /**
   * Execute orchestration decision
   */
  async execute(input: OrchestratorInput): Promise<AgentOutput> {
    try {
      this.initializeMessages();

      // Build context message
      const contextMessage = this.buildContextMessage(input);
      this.addMessage(new HumanMessage(contextMessage));

      // Get decision from model
      const response = await this.getModel().invoke(this.getMessages());
      const decision = this.parseDecision(response as AIMessage);

      // Log decision
      await this.logDecision(decision);

      return {
        output: JSON.stringify(decision),
        success: true,
        metadata: { decision },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Build context message for the model
   */
  private buildContextMessage(input: OrchestratorInput): string {
    const { context } = input;
    
    return `## Current Status
User Request: ${input.input}

### Project State
- Current Phase: ${this.getStateName(context.currentState)}
- Phase Progress: ${context.phaseProgress.completed}/${context.phaseProgress.total} phases complete
- Build Status: ${context.buildStatus}

### Recent Activity
${context.lastAgentOutput ? `Last Agent Output:\n${context.lastAgentOutput}` : 'No recent agent output'}

### Issues
${context.recentErrors.length > 0 
  ? `Recent Errors:\n${context.recentErrors.map(e => `- ${e}`).join('\n')}`
  : 'No recent errors'}

What is your decision for the next action?`;
  }

  /**
   * Parse decision from AI response
   */
  private parseDecision(response: AIMessage): OrchestratorDecision {
    const content = this.parseResponse(response);
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back to parsing text response
    }

    // Default decision based on keywords
    const lowerContent = content.toLowerCase();
    
    return {
      decision: this.inferDecision(lowerContent),
      reasoning: content,
      targetAgent: this.inferTargetAgent(lowerContent),
      instructions: content,
      readyForUser: lowerContent.includes('ready') && !lowerContent.includes('not ready'),
      followUpActions: [],
    };
  }

  /**
   * Infer decision from content
   */
  private inferDecision(content: string): OrchestratorDecision['decision'] {
    if (content.includes('complete') || content.includes('finished')) return 'complete';
    if (content.includes('retry') || content.includes('try again')) return 'retry';
    if (content.includes('escalate') || content.includes('stuck')) return 'escalate';
    if (content.includes('delegate') || content.includes('assign')) return 'delegate';
    return 'proceed';
  }

  /**
   * Infer target agent from content
   */
  private inferTargetAgent(content: string): OrchestratorDecision['targetAgent'] {
    if (content.includes('debug') || content.includes('error') || content.includes('fix')) return 'debug';
    if (content.includes('build') || content.includes('compile')) return 'build';
    if (content.includes('review') || content.includes('quality')) return 'review';
    if (content.includes('generate') || content.includes('code')) return 'codegen';
    return null;
  }

  /**
   * Get human-readable state name
   */
  private getStateName(state: CurrentDevState): string {
    const stateNames: Record<CurrentDevState, string> = {
      [CurrentDevState.IDLE]: 'Idle',
      [CurrentDevState.PHASE_GENERATING]: 'Generating Phase',
      [CurrentDevState.PHASE_IMPLEMENTING]: 'Implementing Phase',
      [CurrentDevState.REVIEWING]: 'Reviewing',
      [CurrentDevState.FINALIZING]: 'Finalizing',
      [CurrentDevState.DEBUGGING]: 'Debugging',
    };
    return stateNames[state] || 'Unknown';
  }

  /**
   * Log decision to state
   */
  private async logDecision(decision: OrchestratorDecision): Promise<void> {
    await this.getStateManager().addMessage({
      role: 'assistant',
      content: `[Orchestrator] Decision: ${decision.decision} - ${decision.reasoning}`,
    });
  }

  /**
   * Quick decision without full context
   */
  async quickDecision(
    currentState: CurrentDevState,
    hasErrors: boolean
  ): Promise<OrchestratorDecision['decision']> {
    if (hasErrors) return 'delegate';
    
    switch (currentState) {
      case CurrentDevState.IDLE:
        return 'proceed';
      case CurrentDevState.PHASE_GENERATING:
      case CurrentDevState.PHASE_IMPLEMENTING:
        return 'proceed';
      case CurrentDevState.REVIEWING:
        return hasErrors ? 'delegate' : 'complete';
      case CurrentDevState.DEBUGGING:
        return 'retry';
      default:
        return 'proceed';
    }
  }
}

export default OrchestratorAgent;





