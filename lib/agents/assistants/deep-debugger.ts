/**
 * Deep Debugger Assistant
 * Autonomous debugging system with self-healing capabilities
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
import { StructuredTool } from '@langchain/core/tools';
import { AgentStateManager } from '../state/agent-state-manager';
import { FileManager } from '../state/file-manager';
import { RuntimeError, FileState, CurrentDevState } from '../state/types';
import { createDebugTools } from '../tools';
import { commandLogBus } from '@/lib/sandbox/telemetry/command-log-bus';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const DEEP_DEBUGGER_PROMPT = `You are an elite autonomous debugging specialist with deep expertise in:
- Root-cause analysis and debugging methodologies
- Modern web frameworks (React, Next.js, Vite)
- TypeScript/JavaScript and build systems
- Runtime error diagnosis and resolution

## CRITICAL: Communication Mode
You have EXTREMELY HIGH reasoning capability. Use it.
- Conduct ALL analysis internally
- Output should be CONCISE: brief status updates and tool calls only
- Think deeply internally → Act decisively externally → Report briefly

## Platform Context
- Apps run in sandbox environments with live preview
- Logs are cumulative and NOT cleared - old errors may persist
- Always verify issues still exist before attempting fixes

## Available Tools
- **run_analysis**: Lint + typecheck (fast, reliable - START HERE)
- **get_runtime_errors**: Recent runtime errors
- **get_logs**: Cumulative logs (use sparingly)
- **read_files**: Read file contents (batch multiple files)
- **regenerate_file**: Apply surgical fixes to existing files
- **generate_files**: Generate new files or complete rewrites
- **run_command**: Execute shell commands
- **deploy_preview**: Deploy changes to verify
- **wait**: Sleep for N seconds

## Debugging Workflow
1. **Diagnose**: Start with run_analysis and get_runtime_errors
2. **Verify**: Always confirm bugs exist in current code
3. **Plan internally**: Don't output verbose plans
4. **Execute decisively**: Make tool calls with minimal commentary
5. **Verify fixes**: Run analysis after changes
6. **Report concisely**: Brief summary

## Critical Rules
- VERIFY BEFORE FIXING: Check if issue still exists in code
- MINIMAL CHANGES: Only change what's necessary
- DON'T REPEAT: If you've tried something twice, try different approach
- DEPLOY AFTER FIXES: Changes don't take effect until deployed

## Using regenerate_file
Provide SPECIFIC issues:
✅ "Fix TypeError: Cannot read property 'items' of undefined - add null check"
✅ "Fix infinite loop in useEffect - add dependency array"
❌ "Fix the code" (too vague)
❌ "Make it work" (not specific)

## Success Criteria
Done when:
- ✅ Errors cleared AND verified via analysis
- 🔄 Stuck after 3+ different approaches
- ❌ Task impossible with available tools

## Output Format
When complete:
{
  "status": "TASK_COMPLETE" | "TASK_STUCK",
  "issuesFound": ["issue1", "issue2"],
  "fixesApplied": ["fix1", "fix2"],
  "filesModified": ["file1.ts"],
  "verificationResult": "passed" | "failed",
  "summary": "Brief description"
}

Once you output TASK_COMPLETE or TASK_STUCK, STOP immediately.`;

// ============================================================================
// TYPES
// ============================================================================

export interface DeepDebugInput {
  issue: string;
  focusPaths?: string[];
  previousTranscript?: string;
}

export interface DeepDebugResult {
  success: boolean;
  status: 'TASK_COMPLETE' | 'TASK_STUCK';
  transcript: string;
  issuesFound: string[];
  fixesApplied: string[];
  filesModified: string[];
  error?: string;
}

interface ToolCallRecord {
  toolName: string;
  args: string;
  timestamp: number;
}

// ============================================================================
// DEEP DEBUGGER CLASS
// ============================================================================

export class DeepDebugger {
  private model: BaseChatModel;
  private stateManager: AgentStateManager;
  private fileManager: FileManager;
  private tools: StructuredTool[];
  private messages: BaseMessage[] = [];
  private toolCallHistory: ToolCallRecord[] = [];
  private repetitionWarnings = 0;
  private maxIterations = 20;

  constructor(
    model: BaseChatModel,
    stateManager: AgentStateManager,
    tools?: StructuredTool[]
  ) {
    this.model = model;
    this.stateManager = stateManager;
    this.fileManager = new FileManager(stateManager);
    this.tools = tools || createDebugTools(stateManager);
  }

  /**
   * Run a debug session
   */
  async debug(input: DeepDebugInput): Promise<DeepDebugResult> {
    // Reset state
    this.messages = [];
    this.toolCallHistory = [];
    this.repetitionWarnings = 0;

    // Set debugging state
    await this.stateManager.setDebugging(true);
    await this.stateManager.setDevState(CurrentDevState.DEBUGGING);

    try {
      // Initialize conversation
      await this.initializeSession(input);

      // Run debug loop
      const result = await this.runDebugLoop();

      // Save transcript
      await this.stateManager.updateState({
        $set: {
          lastDeepDebugTranscript: result.transcript,
          isDebugging: false,
          currentDevState: CurrentDevState.IDLE,
        },
      });

      return result;
    } catch (error) {
      await this.stateManager.setDebugging(false);
      await this.stateManager.setDevState(CurrentDevState.IDLE);

      return {
        success: false,
        status: 'TASK_STUCK',
        transcript: this.getTranscript(),
        issuesFound: [],
        fixesApplied: [],
        filesModified: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Initialize the debug session
   */
  private async initializeSession(input: DeepDebugInput): Promise<void> {
    // Get current state
    const state = await this.stateManager.getState();
    const filesIndex = Object.values(state?.generatedFilesMap || {});
    const runtimeErrors = state?.runtimeErrors || [];

    // Build user message
    const userPrompt = this.buildUserPrompt(input, filesIndex, runtimeErrors);

    // Initialize messages
    this.messages = [
      new SystemMessage(DEEP_DEBUGGER_PROMPT),
      new HumanMessage(userPrompt),
    ];
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(
    input: DeepDebugInput,
    filesIndex: FileState[],
    runtimeErrors: RuntimeError[]
  ): string {
    let prompt = `## Debugging Task
**Issue to resolve**: ${input.issue}

`;

    if (input.previousTranscript) {
      prompt += `## Previous Debug Session
${input.previousTranscript.slice(-2000)}

`;
    }

    prompt += `## Project Files (${filesIndex.length} total)
${this.summarizeFiles(filesIndex)}

`;

    if (input.focusPaths?.length) {
      prompt += `## Focus Paths
${input.focusPaths.join('\n')}

`;
    }

    if (runtimeErrors.length > 0) {
      prompt += `## Runtime Errors (VERIFY BEFORE FIXING)
${this.formatErrors(runtimeErrors)}

`;
    }

    prompt += `## Your Mission
Diagnose and fix the reported issue. Begin.`;

    return prompt;
  }

  /**
   * Run the main debug loop
   */
  private async runDebugLoop(): Promise<DeepDebugResult> {
    let iterations = 0;
    let transcript = '';

    while (iterations < this.maxIterations) {
      iterations++;

      // Get model response
      const response = await this.invokeModelWithTools();
      const content = this.parseContent(response);
      
      transcript += `\n[Iteration ${iterations}]\n${content}\n`;
      this.messages.push(response);

      // Check for completion
      if (this.isComplete(content)) {
        return this.parseResult(content, transcript);
      }

      // Handle tool calls
      if (response.tool_calls?.length) {
        await this.handleToolCalls(response.tool_calls, transcript);
      } else {
        // No tool calls and not complete - might be stuck
        if (iterations >= 3) {
          this.injectPrompt('You seem stuck. Either complete the task or try a different approach.');
        }
      }
    }

    // Max iterations reached
    return {
      success: false,
      status: 'TASK_STUCK',
      transcript,
      issuesFound: [],
      fixesApplied: [],
      filesModified: [],
      error: 'Max iterations reached',
    };
  }

  /**
   * Invoke model with tools
   */
  private async invokeModelWithTools(): Promise<AIMessage> {
    const modelWithTools = this.model.bindTools
      ? this.model.bindTools(this.tools)
      : this.model;

    return await modelWithTools.invoke(this.messages) as AIMessage;
  }

  /**
   * Handle tool calls
   */
  private async handleToolCalls(
    toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }>,
    transcript: string
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      // Check for repetition
      if (this.detectRepetition(toolCall.name, toolCall.args)) {
        this.injectLoopWarning(toolCall.name);
        continue;
      }

      // Find and execute tool
      const tool = this.tools.find(t => t.name === toolCall.name);
      if (tool) {
        try {
          console.log(`[DeepDebugger] Executing tool: ${toolCall.name}`);
          const result = await tool.invoke(toolCall.args);
          
          this.messages.push(new ToolMessage({
            tool_call_id: toolCall.id || toolCall.name,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          }));
        } catch (error) {
          this.messages.push(new ToolMessage({
            tool_call_id: toolCall.id || toolCall.name,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        this.messages.push(new ToolMessage({
          tool_call_id: toolCall.id || toolCall.name,
          content: `Error: Tool ${toolCall.name} not found`,
        }));
      }
    }
  }

  /**
   * Detect repetitive tool calls
   */
  private detectRepetition(toolName: string, args: Record<string, unknown>): boolean {
    const argsStr = JSON.stringify(args);
    const now = Date.now();

    // Keep only recent calls
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

    const warning = `⚠️ REPETITION DETECTED: You've called "${toolName}" with identical arguments ${this.repetitionWarnings} times.

STOP and either:
1. State "TASK_COMPLETE" if done
2. Try a DIFFERENT approach
3. State "TASK_STUCK" if genuinely stuck

DO NOT repeat the same action.`;

    this.messages.push(new HumanMessage(warning));
  }

  /**
   * Inject a prompt
   */
  private injectPrompt(message: string): void {
    this.messages.push(new HumanMessage(message));
  }

  /**
   * Parse AI message content
   */
  private parseContent(message: AIMessage): string {
    return typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
  }

  /**
   * Check if response indicates completion
   */
  private isComplete(content: string): boolean {
    return content.includes('TASK_COMPLETE') || content.includes('TASK_STUCK');
  }

  /**
   * Parse result from content
   */
  private parseResult(content: string, transcript: string): DeepDebugResult {
    const isComplete = content.includes('TASK_COMPLETE');

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: isComplete,
          status: parsed.status || (isComplete ? 'TASK_COMPLETE' : 'TASK_STUCK'),
          transcript,
          issuesFound: parsed.issuesFound || [],
          fixesApplied: parsed.fixesApplied || [],
          filesModified: parsed.filesModified || [],
        };
      }
    } catch {
      // Parse from text
    }

    return {
      success: isComplete,
      status: isComplete ? 'TASK_COMPLETE' : 'TASK_STUCK',
      transcript,
      issuesFound: this.extractList(content, 'issues'),
      fixesApplied: this.extractList(content, 'fixes'),
      filesModified: this.extractList(content, 'files'),
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
   * Get conversation transcript
   */
  private getTranscript(): string {
    return this.messages
      .map(m => {
        if (m instanceof SystemMessage) return '[System] ' + m.content;
        if (m instanceof HumanMessage) return '[User] ' + m.content;
        if (m instanceof AIMessage) return '[Assistant] ' + m.content;
        if (m instanceof ToolMessage) return '[Tool] ' + m.content;
        return String(m.content);
      })
      .join('\n\n');
  }

  /**
   * Summarize files
   */
  private summarizeFiles(files: FileState[], max = 50): string {
    const summaries = files
      .slice(0, max)
      .map(f => `- ${f.filePath}${f.filePurpose ? ` — ${f.filePurpose}` : ''}`);

    const extra = files.length > max ? `\n...and ${files.length - max} more` : '';
    return summaries.join('\n') + extra;
  }

  /**
   * Format errors
   */
  private formatErrors(errors: RuntimeError[]): string {
    return errors.map(e => {
      let msg = `- [${e.type}] ${e.message}`;
      if (e.filePath) msg += `\n  File: ${e.filePath}`;
      if (e.line) msg += `:${e.line}`;
      return msg;
    }).join('\n');
  }
}

export default DeepDebugger;




