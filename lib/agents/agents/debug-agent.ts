/**
 * Debug Agent
 * Investigates and fixes runtime errors autonomously
 */

import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { BaseAgent, AgentConfig, AgentContext, AgentInput, AgentOutput } from './base-agent';
import { RuntimeError, FileState } from '../state/types';
import { FileManager } from '../state/file-manager';
import { StructuredTool } from '@langchain/core/tools';

const DEBUG_SYSTEM_PROMPT = `You are the Debug Agent - an elite autonomous debugging specialist with deep expertise in:
- Root-cause analysis
- Modern web frameworks (React, Next.js, Vite)
- TypeScript/JavaScript
- Build tools and runtime environments

## Your Mission
Diagnose and fix code issues autonomously. You have HIGH reasoning capability - use it.

## Critical Rules
1. **Internal Reasoning**: Analyze deeply internally, output concisely
2. **Verify Before Fixing**: Always confirm bugs exist before attempting fixes
3. **Minimal Changes**: Make surgical fixes - change only what's necessary
4. **Action-Oriented**: Don't explain, execute. Don't plan, act.

## Available Tools
- **read_files**: Read file contents (batch multiple files in one call)
- **regenerate_file**: Apply surgical fixes to existing files
- **run_analysis**: Run lint and typecheck (fast, reliable)
- **get_runtime_errors**: Get recent runtime errors
- **run_command**: Execute shell commands
- **deploy_preview**: Deploy changes to verify fixes

## Debugging Workflow
1. **Diagnose**: Start with run_analysis and get_runtime_errors
2. **Plan internally**: Don't output verbose plans
3. **Execute decisively**: Make tool calls with minimal commentary
4. **Verify fixes**: Run analysis after changes
5. **Report concisely**: Brief summary of what was done

## Common Issues to Watch For
- TypeScript errors (missing types, wrong imports)
- React hooks issues (missing dependencies, rules of hooks)
- Build errors (module resolution, syntax errors)
- Runtime errors (null references, async issues)

## Success Criteria
You're done when:
- ✅ Errors cleared AND verified via analysis
- 🔄 Genuinely stuck after trying 3+ approaches
- ❌ Task impossible with available tools

## Output Format
When complete, respond with:
{
  "status": "TASK_COMPLETE" | "TASK_STUCK",
  "issuesFound": ["issue1", "issue2"],
  "fixesApplied": ["fix1", "fix2"],
  "filesModified": ["file1.ts", "file2.ts"],
  "verificationResult": "passed" | "failed",
  "summary": "Brief description of what was done"
}`;

export interface DebugInput extends AgentInput {
  context: {
    issue: string;
    runtimeErrors: RuntimeError[];
    filesIndex: FileState[];
    focusPaths?: string[];
    previousTranscript?: string;
  };
}

export interface DebugResult {
  status: 'TASK_COMPLETE' | 'TASK_STUCK';
  issuesFound: string[];
  fixesApplied: string[];
  filesModified: string[];
  verificationResult: 'passed' | 'failed';
  summary: string;
  transcript: string;
}

interface ToolCallRecord {
  toolName: string;
  args: string;
  timestamp: number;
}

/**
 * DebugAgent - Autonomous debugging specialist
 */
export class DebugAgent extends BaseAgent {
  private fileManager: FileManager;
  private toolCallHistory: ToolCallRecord[] = [];
  private repetitionWarnings = 0;

  constructor(context: AgentContext) {
    const config: AgentConfig = {
      name: 'DebugAgent',
      description: 'Investigates and fixes runtime errors autonomously',
      systemPrompt: DEBUG_SYSTEM_PROMPT,
      maxIterations: 15,
      temperature: 0.3,
    };
    super(config, context);
    this.fileManager = new FileManager(context.stateManager);
  }

  /**
   * Execute debugging session
   */
  async execute(input: DebugInput): Promise<AgentOutput> {
    try {
      this.initializeMessages();
      this.toolCallHistory = [];
      this.repetitionWarnings = 0;

      // Build context message
      const contextMessage = this.buildContextMessage(input);
      this.addMessage(new HumanMessage(contextMessage));

      // Run debug loop with tools
      const result = await this.runDebugLoop();

      // Set debugging state
      await this.getStateManager().setDebugging(false);

      return {
        output: JSON.stringify(result),
        success: result.status === 'TASK_COMPLETE',
        metadata: { result },
      };
    } catch (error) {
      await this.getStateManager().setDebugging(false);
      return this.handleError(error);
    }
  }

  /**
   * Run the main debug loop
   */
  private async runDebugLoop(): Promise<DebugResult> {
    const tools = this.getTools();
    const maxIterations = this.config.maxIterations || 15;
    let iterations = 0;
    let transcript = '';

    while (iterations < maxIterations) {
      iterations++;

      // Get model response
      const response = await this.getModelWithTools(tools).invoke(this.getMessages());
      const content = this.parseResponse(response as AIMessage);
      transcript += `\n[Iteration ${iterations}]\n${content}\n`;
      
      this.addMessage(response as AIMessage);

      // Check for completion signals
      if (this.isComplete(content)) {
        return this.parseDebugResult(content, transcript);
      }

      // Handle tool calls
      const aiMessage = response as AIMessage;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        for (const toolCall of aiMessage.tool_calls) {
          // Check for repetition
          if (this.detectRepetition(toolCall.name, toolCall.args)) {
            this.injectLoopWarning(toolCall.name);
            continue;
          }

          // Execute tool
          const tool = tools.find(t => t.name === toolCall.name);
          if (tool) {
            try {
              const result = await tool.invoke(toolCall.args);
              transcript += `\n[Tool: ${toolCall.name}]\n${JSON.stringify(result).slice(0, 500)}...\n`;
              
              this.addMessage(new ToolMessage({
                tool_call_id: toolCall.id || toolCall.name,
                content: typeof result === 'string' ? result : JSON.stringify(result),
              }));
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              this.addMessage(new ToolMessage({
                tool_call_id: toolCall.id || toolCall.name,
                content: `Error: ${errorMsg}`,
              }));
            }
          }
        }
      } else {
        // No tool calls and not complete - likely stuck
        break;
      }
    }

    // Max iterations reached
    return {
      status: 'TASK_STUCK',
      issuesFound: [],
      fixesApplied: [],
      filesModified: [],
      verificationResult: 'failed',
      summary: 'Max iterations reached without resolution',
      transcript,
    };
  }

  /**
   * Get model with tools bound
   */
  private getModelWithTools(tools: StructuredTool[]) {
    const model = this.getModel();
    if (tools.length === 0 || !model.bindTools) {
      return model;
    }
    return model.bindTools(tools);
  }

  /**
   * Build context message
   */
  private buildContextMessage(input: DebugInput): string {
    const { issue, runtimeErrors, filesIndex, focusPaths, previousTranscript } = input.context;

    let message = `## Debugging Task
**Issue to resolve**: ${issue}

`;

    if (previousTranscript) {
      message += `## Previous Debug Session
${previousTranscript}

`;
    }

    message += `## Project Files (${filesIndex.length} total)
${this.summarizeFiles(filesIndex)}

`;

    if (focusPaths && focusPaths.length > 0) {
      message += `## Focus Paths
${focusPaths.join('\n')}

`;
    }

    if (runtimeErrors.length > 0) {
      message += `## Runtime Errors (VERIFY BEFORE FIXING)
${this.formatErrors(runtimeErrors)}

`;
    }

    message += `## Your Mission
Diagnose and fix the reported issue. Begin.`;

    return message;
  }

  /**
   * Summarize files for context
   */
  private summarizeFiles(files: FileState[], max = 50): string {
    const summaries = files
      .slice(0, max)
      .map(f => `- ${f.filePath}${f.filePurpose ? ` — ${f.filePurpose}` : ''}`);

    const extra = files.length > max ? `\n...and ${files.length - max} more` : '';
    return summaries.join('\n') + extra;
  }

  /**
   * Format runtime errors
   */
  private formatErrors(errors: RuntimeError[]): string {
    return errors.map(e => {
      let msg = `- [${e.type}] ${e.message}`;
      if (e.filePath) msg += `\n  File: ${e.filePath}`;
      if (e.line) msg += `:${e.line}`;
      if (e.column) msg += `:${e.column}`;
      return msg;
    }).join('\n');
  }

  /**
   * Check if response indicates completion
   */
  private isComplete(content: string): boolean {
    return content.includes('TASK_COMPLETE') || 
           content.includes('TASK_STUCK') ||
           content.includes('"status"');
  }

  /**
   * Parse debug result from response
   */
  private parseDebugResult(content: string, transcript: string): DebugResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          transcript,
        };
      }
    } catch {
      // Parse from content
    }

    const isComplete = content.includes('TASK_COMPLETE');
    return {
      status: isComplete ? 'TASK_COMPLETE' : 'TASK_STUCK',
      issuesFound: this.extractList(content, 'issues'),
      fixesApplied: this.extractList(content, 'fixes'),
      filesModified: this.extractList(content, 'files'),
      verificationResult: content.includes('passed') ? 'passed' : 'failed',
      summary: this.extractSummary(content),
      transcript,
    };
  }

  /**
   * Extract list from content
   */
  private extractList(content: string, type: string): string[] {
    const regex = new RegExp(`${type}[:\\s]*\\[([^\\]]+)\\]`, 'i');
    const match = content.match(regex);
    if (match) {
      return match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
    }
    return [];
  }

  /**
   * Extract summary from content
   */
  private extractSummary(content: string): string {
    const summaryMatch = content.match(/summary[:\s]*["']?([^"'\n]+)/i);
    return summaryMatch ? summaryMatch[1] : content.slice(0, 200);
  }

  /**
   * Detect repetitive tool calls
   */
  private detectRepetition(toolName: string, args: Record<string, unknown>): boolean {
    const argsStr = JSON.stringify(args);
    const now = Date.now();

    // Keep only recent calls (last 10 minutes)
    this.toolCallHistory = this.toolCallHistory.filter(
      call => now - call.timestamp < 600000
    );

    // Count matching calls
    const matchingCalls = this.toolCallHistory.filter(
      call => call.toolName === toolName && call.args === argsStr
    );

    // Record this call
    this.toolCallHistory.push({ toolName, args: argsStr, timestamp: now });

    return matchingCalls.length >= 2;
  }

  /**
   * Inject loop warning
   */
  private injectLoopWarning(toolName: string): void {
    this.repetitionWarnings++;

    const warning = `⚠️ REPETITION DETECTED: You've called "${toolName}" with the same arguments multiple times.

Either:
1. State "TASK_COMPLETE" if done
2. Try a DIFFERENT approach
3. State "TASK_STUCK" if genuinely stuck`;

    this.addMessage(new HumanMessage(warning));
  }
}

export default DebugAgent;




