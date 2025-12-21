import { EventEmitter } from 'events';

/**
 * Command log event emitted whenever the sandbox runs a command.
 * Includes stdout/stderr so higher-level agents can stream logs in real time.
 */
export interface CommandLogEvent {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  timestamp: Date;
  provider?: string;
  sandboxId?: string;
  cwd?: string;
  durationMs?: number;
  tags?: string[];
  meta?: Record<string, any>;
}

type CommandListener = (event: CommandLogEvent) => void;

class CommandLogBus {
  private emitter = new EventEmitter();
  private buffer: CommandLogEvent[] = [];
  private readonly maxBuffer = 200;

  emit(event: CommandLogEvent): void {
    // Keep a small rolling buffer so late subscribers can pick up recent context
    this.buffer.push(event);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }

    this.emitter.emit('event', event);
  }

  subscribe(listener: CommandListener): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }

  getRecent(limit: number = 50): CommandLogEvent[] {
    return this.buffer.slice(Math.max(this.buffer.length - limit, 0));
  }

  /**
   * Clear the internal buffer of recent command events.
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Convert the log stream into an async iterable so LangChain agents
   * can consume logs as a stream.
   */
  asAsyncIterable(): AsyncIterable<CommandLogEvent> {
    const emitter = this.emitter;
    return {
      [Symbol.asyncIterator](): AsyncIterator<CommandLogEvent> {
        const queue: CommandLogEvent[] = [];
        let resolveNext: ((value: IteratorResult<CommandLogEvent>) => void) | null = null;

        const handler = (event: CommandLogEvent) => {
          if (resolveNext) {
            resolveNext({ value: event, done: false });
            resolveNext = null;
          } else {
            queue.push(event);
          }
        };

        emitter.on('event', handler);

        return {
          next(): Promise<IteratorResult<CommandLogEvent>> {
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift()!, done: false });
            }

            return new Promise<IteratorResult<CommandLogEvent>>(resolve => {
              resolveNext = resolve;
            });
          },
          return(): Promise<IteratorResult<CommandLogEvent>> {
            emitter.off('event', handler);
            return Promise.resolve({ value: undefined as any, done: true });
          }
        };
      }
    };
  }
}

export const commandLogBus = new CommandLogBus();

export default commandLogBus;
