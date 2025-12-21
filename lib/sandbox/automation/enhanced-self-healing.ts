/**
 * Enhanced Self-Healing Pipeline
 * Real-time log streaming with AI-powered automatic recovery
 */

import { EventEmitter } from 'events';
import { commandLogBus, CommandLogEvent } from '../telemetry/command-log-bus';
import { sandboxManager } from '../sandbox-manager';
import { buildErrorHandler } from '../recovery/build-error-handler';
import { environmentValidator } from '../validation/environment-validator';
import { ModelFactory } from '@/lib/agents/models/model-factory';
import { appConfig } from '@/config/app.config';
import { DeepDebugger } from '@/lib/agents/assistants/deep-debugger';
import { AgentStateManager } from '@/lib/agents/state/agent-state-manager';
import { createDebugTools } from '@/lib/agents/tools';

// ============================================================================
// TYPES
// ============================================================================

export interface SelfHealingConfig {
  enabled: boolean;
  autoLint: boolean;
  autoBuild: boolean;
  autoDebug: boolean;
  validateAfterRecovery: boolean;
  debounceMs: number;
  maxRetries: number;
  aiModelId?: string;
  sessionId?: string;
}

export interface LogStreamEvent {
  type: 'command' | 'build' | 'runtime' | 'lint' | 'recovery';
  timestamp: Date;
  message: string;
  data?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'success';
}

export interface RecoveryResult {
  success: boolean;
  action: string;
  message: string;
  duration: number;
  retriesUsed: number;
}

// ============================================================================
// ENHANCED SELF-HEALING SUPERVISOR
// ============================================================================

export class EnhancedSelfHealingSupervisor extends EventEmitter {
  private config: SelfHealingConfig = {
    enabled: true,
    autoLint: true,
    autoBuild: true,
    autoDebug: true,
    validateAfterRecovery: true,
    debounceMs: 1500,
    maxRetries: 3,
  };

  private unsubscribeFn: (() => void) | null = null;
  private runningCheck = false;
  private runningRecovery = false;
  private pendingCheck: NodeJS.Timeout | null = null;
  private recoveryAttempts = 0;
  private stateManager: AgentStateManager | null = null;
  private deepDebugger: DeepDebugger | null = null;
  private logBuffer: LogStreamEvent[] = [];
  private maxLogBuffer = 100;

  /**
   * Start the self-healing supervisor
   */
  start(options: Partial<SelfHealingConfig> = {}): void {
    const previousSessionId = this.config.sessionId;
    this.config = { ...this.config, ...options };

    if (this.unsubscribeFn) {
      if (this.config.sessionId && this.config.sessionId !== previousSessionId) {
        this.stateManager = new AgentStateManager(this.config.sessionId);
        void this.initializeDebugger();
      }
      return;
    }

    // Initialize state manager if session provided
    if (this.config.sessionId) {
      this.stateManager = new AgentStateManager(this.config.sessionId);
      void this.initializeDebugger();
    }

    // Subscribe to command logs
    this.unsubscribeFn = commandLogBus.subscribe(event => this.handleEvent(event));

    this.emitLog('info', 'Self-healing supervisor started', {
      config: {
        autoLint: this.config.autoLint,
        autoBuild: this.config.autoBuild,
        autoDebug: this.config.autoDebug,
      },
    });

    console.log('[EnhancedSelfHealing] Started');
  }

  /**
   * Stop the supervisor
   */
  stop(): void {
    this.unsubscribeFn?.();
    this.unsubscribeFn = null;

    if (this.pendingCheck) {
      clearTimeout(this.pendingCheck);
      this.pendingCheck = null;
    }

    this.emitLog('info', 'Self-healing supervisor stopped');
    console.log('[EnhancedSelfHealing] Stopped');
  }

  /**
   * Initialize the AI debugger
   */
  private async initializeDebugger(): Promise<void> {
    if (!this.stateManager) return;

    try {
      const modelConfig = ModelFactory.fromModelId(
        this.config.aiModelId || appConfig.ai.defaultModel,
        { apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY }
      );
      const model = ModelFactory.create(modelConfig);
      const tools = createDebugTools(this.stateManager);

      this.deepDebugger = new DeepDebugger(model, this.stateManager, tools);
      console.log('[EnhancedSelfHealing] DeepDebugger initialized');
    } catch (error) {
      console.error('[EnhancedSelfHealing] Failed to initialize debugger:', error);
    }
  }

  /**
   * Handle incoming command log event
   */
  private handleEvent(event: CommandLogEvent): void {
    // Log the event
    this.emitLog(
      event.success ? 'info' : 'error',
      `Command ${event.success ? 'succeeded' : 'failed'}: ${event.command}`,
      {
        exitCode: event.exitCode,
        duration: event.durationMs,
        stdout: event.stdout?.slice(0, 500),
        stderr: event.stderr?.slice(0, 500),
      }
    );

    // Stream to AI in real-time
    this.streamToAI(event);

    if (!event.success) {
      // Immediate recovery on failure
      this.triggerRecovery(event);
      return;
    }

    // After installs or build commands, schedule a check
    if (event.tags?.includes('install') || this.isBuildLikeCommand(event.command)) {
      this.scheduleFullCheck(event.command);
    }
  }

  /**
   * Stream log events to AI pipeline
   */
  private async streamToAI(event: CommandLogEvent): Promise<void> {
    if (!this.stateManager) return;

    // Add to state for AI visibility
    try {
      await this.stateManager.addCommandLog({
        command: event.command,
        stdout: event.stdout || '',
        stderr: event.stderr || '',
        exitCode: event.exitCode,
        success: event.success,
        durationMs: event.durationMs,
        tags: event.tags,
        provider: event.provider,
        sandboxId: event.sandboxId,
        cwd: event.cwd,
        meta: event.meta,
      });

      if (!event.success && event.stderr) {
        await this.stateManager.addRuntimeError({
          type: this.categorizeError(event),
          message: event.stderr.slice(0, 500),
          filePath: this.extractFilePath(event.stderr),
        });
      }

      // Add command to history
      await this.stateManager.addCommand(event.command);
    } catch (error) {
      console.error('[EnhancedSelfHealing] Failed to stream to AI:', error);
    }
  }

  /**
   * Categorize error type
   */
  private categorizeError(event: CommandLogEvent): 'compile' | 'runtime' | 'lint' | 'build' {
    const cmd = event.command.toLowerCase();
    const stderr = (event.stderr || '').toLowerCase();

    if (cmd.includes('lint') || stderr.includes('eslint')) return 'lint';
    if (cmd.includes('tsc') || stderr.includes('typescript')) return 'compile';
    if (cmd.includes('build')) return 'build';
    return 'runtime';
  }

  /**
   * Extract file path from error message
   */
  private extractFilePath(stderr: string): string | undefined {
    const match = stderr.match(/(?:in|at|from)\s+['"]?([./][\w/.:-]+\.(?:ts|tsx|js|jsx))/i);
    return match?.[1];
  }

  /**
   * Check if command is build-related
   */
  private isBuildLikeCommand(command: string): boolean {
    return /npm run (dev|build|start|lint)|pnpm|yarn/.test(command);
  }

  /**
   * Schedule a full check after a delay
   */
  private scheduleFullCheck(reason: string): void {
    if (this.pendingCheck) {
      clearTimeout(this.pendingCheck);
    }

    this.pendingCheck = setTimeout(() => {
      this.runFullCheck(reason);
    }, this.config.debounceMs);
  }

  /**
   * Run full lint/build/validation check
   */
  async runFullCheck(reason: string = 'manual'): Promise<void> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      this.emitLog('warning', 'No active provider for full check');
      return;
    }

    if (this.runningCheck) {
      return;
    }

    this.runningCheck = true;
    this.emitLog('info', `Running full check (${reason})`);

    try {
      // Run lint
      if (this.config.autoLint) {
        this.emitLog('info', 'Running lint check');
        const lintResult = await provider.runCommand('npm run lint 2>&1 || true');
        
        if (lintResult.exitCode !== 0) {
          this.emitLog('warning', 'Lint issues detected', {
            output: lintResult.stdout?.slice(0, 1000),
          });
        } else {
          this.emitLog('success', 'Lint check passed');
        }
      }

      // Run build
      if (this.config.autoBuild) {
        this.emitLog('info', 'Running build check');
        const buildResult = await provider.runCommand('npm run build 2>&1 || true');
        
        if (buildResult.exitCode !== 0) {
          this.emitLog('error', 'Build failed', {
            output: buildResult.stderr?.slice(0, 1000),
          });
          
          // Trigger AI-powered recovery if enabled
          if (this.config.autoDebug && this.deepDebugger) {
            await this.triggerAIDebug('Build failed: ' + (buildResult.stderr?.slice(0, 500) || 'Unknown error'));
          }
        } else {
          this.emitLog('success', 'Build check passed');
        }
      }

      // Validate environment
      if (this.config.validateAfterRecovery) {
        const validation = await environmentValidator.validate();
        if (!validation.valid) {
          this.emitLog('warning', 'Environment validation failed', {
            errors: validation.errors,
          });
          await buildErrorHandler.recover(validation.errors);
        }
      }
    } catch (err) {
      this.emitLog('error', 'Full check failed', { error: String(err) });
    } finally {
      this.runningCheck = false;
    }
  }

  /**
   * Trigger recovery for a failed command
   */
  private async triggerRecovery(event: CommandLogEvent): Promise<void> {
    if (this.runningRecovery) {
      return;
    }

    this.runningRecovery = true;
    this.recoveryAttempts++;
    const startTime = Date.now();

    this.emitLog('warning', `Command failed, attempting recovery (attempt ${this.recoveryAttempts})`, {
      command: event.command,
      exitCode: event.exitCode,
    });

    try {
      // First, try standard error recovery
      const detectedErrors = buildErrorHandler.detectErrors(`${event.stdout}\n${event.stderr}`);
      const errors = detectedErrors.length
        ? detectedErrors
        : [{ type: 'build' as const, message: event.stderr || 'Command failed', raw: event.stderr }];

      const recoveryResult = await buildErrorHandler.recover(errors);

      if (recoveryResult.success) {
        this.emitLog('success', 'Standard recovery successful');
        this.recoveryAttempts = 0;
      } else if (this.recoveryAttempts >= this.config.maxRetries) {
        // Standard recovery failed, try AI-powered debugging
        if (this.config.autoDebug && this.deepDebugger) {
          this.emitLog('info', 'Standard recovery failed, trying AI debugger');
          await this.triggerAIDebug(event.stderr || event.stdout || 'Command failed');
        } else {
          this.emitLog('error', 'Recovery failed after max retries');
        }
      }

      // Validate after recovery
      if (this.config.validateAfterRecovery) {
        const validation = await environmentValidator.validate();
        if (!validation.valid) {
          await buildErrorHandler.recover(validation.errors);
        }
      }

      const duration = Date.now() - startTime;
      this.emit('recovery', {
        success: recoveryResult.success,
        action: 'standard_recovery',
        message: recoveryResult.success ? 'Recovery successful' : 'Recovery failed',
        duration: recoveryResult.duration ?? duration,
        retriesUsed: recoveryResult.attemptsMade ?? this.recoveryAttempts,
      } as RecoveryResult);

    } catch (err) {
      this.emitLog('error', 'Recovery failed', { error: String(err) });
    } finally {
      this.runningRecovery = false;
    }
  }

  /**
   * Trigger AI-powered debugging
   */
  private async triggerAIDebug(issue: string): Promise<void> {
    if (!this.deepDebugger) {
      this.emitLog('warning', 'AI debugger not available');
      return;
    }

    this.emitLog('info', 'Starting AI-powered debug session', { issue });
    const startTime = Date.now();

    try {
      const result = await this.deepDebugger.debug({
        issue,
        previousTranscript: undefined,
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        this.emitLog('success', 'AI debug session completed successfully', {
          fixesApplied: result.fixesApplied,
          filesModified: result.filesModified,
        });
        this.recoveryAttempts = 0;
      } else {
        this.emitLog('warning', 'AI debug session could not resolve issue', {
          status: result.status,
          error: result.error,
        });
      }

      this.emit('recovery', {
        success: result.success,
        action: 'ai_debug',
        message: result.success ? 'AI debug successful' : 'AI debug failed',
        duration,
        retriesUsed: this.recoveryAttempts,
      } as RecoveryResult);

    } catch (error) {
      this.emitLog('error', 'AI debug session failed', { error: String(error) });
    }
  }

  /**
   * Emit a log event
   */
  private emitLog(
    severity: LogStreamEvent['severity'],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const event: LogStreamEvent = {
      type: 'recovery',
      timestamp: new Date(),
      message,
      data,
      severity,
    };

    // Add to buffer
    this.logBuffer.push(event);
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer.shift();
    }

    // Emit event
    this.emit('log', event);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count = 50): LogStreamEvent[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get recovery statistics
   */
  getStats(): {
    recoveryAttempts: number;
    isRecovering: boolean;
    isChecking: boolean;
    logsBuffered: number;
  } {
    return {
      recoveryAttempts: this.recoveryAttempts,
      isRecovering: this.runningRecovery,
      isChecking: this.runningCheck,
      logsBuffered: this.logBuffer.length,
    };
  }

  /**
   * Subscribe to log stream
   */
  onLog(callback: (event: LogStreamEvent) => void): () => void {
    this.on('log', callback);
    return () => this.off('log', callback);
  }

  /**
   * Subscribe to recovery events
   */
  onRecovery(callback: (result: RecoveryResult) => void): () => void {
    this.on('recovery', callback);
    return () => this.off('recovery', callback);
  }
}

// Singleton instance
export const enhancedSelfHealing = new EnhancedSelfHealingSupervisor();
export default enhancedSelfHealing;


