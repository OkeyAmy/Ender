import { commandLogBus, CommandLogEvent } from '../telemetry/command-log-bus';
import { sandboxManager } from '../sandbox-manager';
import { buildErrorHandler } from '../recovery/build-error-handler';
import { environmentValidator } from '../validation/environment-validator';

interface SelfHealingConfig {
  autoLint: boolean;
  autoBuild: boolean;
  validateAfterRecovery: boolean;
  debounceMs: number;
}

/**
 * Watches sandbox command output in real time and auto-runs lint/build checks.
 * If a command fails, it triggers recovery strategies immediately.
 */
class SelfHealingSupervisor {
  private unsubscribeFn: (() => void) | null = null;
  private runningCheck = false;
  private runningRecovery = false;
  private pendingCheck: NodeJS.Timeout | null = null;
  private config: SelfHealingConfig = {
    autoLint: true,
    autoBuild: true,
    validateAfterRecovery: true,
    debounceMs: 1500
  };

  start(options: Partial<SelfHealingConfig> = {}): void {
    this.config = { ...this.config, ...options };

    if (this.unsubscribeFn) {
      return;
    }

    this.unsubscribeFn = commandLogBus.subscribe(event => this.handleEvent(event));
    console.log('[SelfHealingSupervisor] Started');
  }

  stop(): void {
    this.unsubscribeFn?.();
    this.unsubscribeFn = null;

    if (this.pendingCheck) {
      clearTimeout(this.pendingCheck);
      this.pendingCheck = null;
    }

    console.log('[SelfHealingSupervisor] Stopped');
  }

  /**
   * Manually trigger a lint/build/validation sweep.
   */
  async runFullCheck(reason: string = 'manual'): Promise<void> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      console.warn('[SelfHealingSupervisor] No active provider for runFullCheck');
      return;
    }

    if (this.runningCheck) {
      return;
    }

    this.runningCheck = true;
    console.log(`[SelfHealingSupervisor] Running full check (${reason})`);

    try {
      if (this.config.autoLint) {
        await provider.runCommand('npm run lint');
      }

      if (this.config.autoBuild) {
        await provider.runCommand('npm run build');
      }

      if (this.config.validateAfterRecovery) {
        const validation = await environmentValidator.validate();
        if (!validation.valid) {
          await buildErrorHandler.recover(validation.errors);
        }
      }
    } catch (err) {
      console.error('[SelfHealingSupervisor] Full check failed', err);
    } finally {
      this.runningCheck = false;
    }
  }

  private handleEvent(event: CommandLogEvent): void {
    if (!event.success) {
      // Immediate recovery on failure
      this.triggerRecovery(event);
      return;
    }

    // After installs or other risky commands, schedule a sweep.
    if (event.tags?.includes('install') || this.isBuildLikeCommand(event.command)) {
      this.scheduleFullCheck(event.command);
    }
  }

  private isBuildLikeCommand(command: string): boolean {
    return /npm run (dev|build|start|lint)/i.test(command) || /pnpm/.test(command) || /yarn/.test(command);
  }

  private scheduleFullCheck(reason: string): void {
    if (this.pendingCheck) {
      clearTimeout(this.pendingCheck);
    }

    this.pendingCheck = setTimeout(() => {
      this.runFullCheck(reason);
    }, this.config.debounceMs);
  }

  private async triggerRecovery(event: CommandLogEvent): Promise<void> {
    if (this.runningRecovery) {
      return;
    }

    this.runningRecovery = true;
    console.warn('[SelfHealingSupervisor] Command failed, attempting recovery', {
      command: event.command,
      exitCode: event.exitCode
    });

    try {
      const detectedErrors = buildErrorHandler.detectErrors(`${event.stdout}\n${event.stderr}`);
      const errors = detectedErrors.length
        ? detectedErrors
        : [{ type: 'build' as const, message: event.stderr || 'Command failed', raw: event.stderr }];

      await buildErrorHandler.recover(errors);

      if (this.config.validateAfterRecovery) {
        const validation = await environmentValidator.validate();
        if (!validation.valid) {
          await buildErrorHandler.recover(validation.errors);
        }
      }
    } catch (err) {
      console.error('[SelfHealingSupervisor] Recovery failed', err);
    } finally {
      this.runningRecovery = false;
    }
  }
}

export const selfHealingSupervisor = new SelfHealingSupervisor();

export default selfHealingSupervisor;
