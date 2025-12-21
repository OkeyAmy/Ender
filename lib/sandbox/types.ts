import { commandLogBus, CommandLogEvent } from './telemetry/command-log-bus';

export interface SandboxFile {
  path: string;
  content: string;
  lastModified?: number;
}

export interface SandboxInfo {
  sandboxId: string;
  url: string;
  provider: 'e2b' | 'vercel';
  createdAt: Date;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  command?: string;
  cwd?: string;
  durationMs?: number;
  timestamp?: Date;
  meta?: Record<string, any>;
}

export interface SandboxProviderConfig {
  e2b?: {
    apiKey: string;
    timeoutMs?: number;
    template?: string;
  };
  vercel?: {
    teamId?: string;
    projectId?: string;
    token?: string;
    authMethod?: 'oidc' | 'pat';
  };
}

export abstract class SandboxProvider {
  protected config: SandboxProviderConfig;
  protected sandbox: any;
  protected sandboxInfo: SandboxInfo | null = null;
  private commandListeners: Set<(event: CommandLogEvent) => void> = new Set();

  constructor(config: SandboxProviderConfig) {
    this.config = config;
  }

  abstract createSandbox(): Promise<SandboxInfo>;
  abstract runCommand(command: string): Promise<CommandResult>;
  abstract writeFile(path: string, content: string): Promise<void>;
  abstract readFile(path: string): Promise<string>;
  abstract listFiles(directory?: string): Promise<string[]>;
  abstract installPackages(packages: string[]): Promise<CommandResult>;
  abstract getSandboxUrl(): string | null;
  abstract getSandboxInfo(): SandboxInfo | null;
  abstract terminate(): Promise<void>;
  abstract isAlive(): boolean;
  
  /**
   * Subscribe to command events for this provider.
   * Returns an unsubscribe function.
   */
  onCommand(listener: (event: CommandLogEvent) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }
  
  /**
   * Emit a command log event to all listeners and the global bus.
   */
  protected emitCommandEvent(event: CommandLogEvent): void {
    // Local listeners (provider-level)
    for (const listener of this.commandListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[SandboxProvider] Command listener error', err);
      }
    }

    // Global bus for orchestration/agents
    commandLogBus.emit(event);
  }
  
  /**
   * Helper to build a structured command event with provider metadata.
   */
  protected buildCommandEvent(command: string, result: CommandResult, meta: Partial<CommandLogEvent> = {}): CommandLogEvent {
    return {
      command,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: typeof result.exitCode === 'number' ? result.exitCode : 1,
      success: result.success,
      timestamp: meta.timestamp || new Date(),
      provider: this.sandboxInfo?.provider,
      sandboxId: this.sandboxInfo?.sandboxId,
      durationMs: result.durationMs,
      cwd: result.cwd,
      meta: result.meta,
      ...meta,
    };
  }
  
  // Optional methods that providers can override
  async setupViteApp(): Promise<void> {
    // Default implementation for setting up a Vite React app
    throw new Error('setupViteApp not implemented for this provider');
  }
  
  async restartViteServer(): Promise<void> {
    // Default implementation for restarting Vite
    throw new Error('restartViteServer not implemented for this provider');
  }
}
