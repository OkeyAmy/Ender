/**
 * Sandbox Tools
 * LangChain tools for sandbox operations
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { commandLogBus } from '@/lib/sandbox/telemetry/command-log-bus';

/**
 * Run Command Tool
 * Executes shell commands in the sandbox
 */
export class RunCommandTool extends StructuredTool {
  name = 'run_command';
  description = 'Execute a shell command in the sandbox. Use for npm install, build commands, etc.';
  
  schema = z.object({
    command: z.string().describe('The shell command to execute'),
    shouldSave: z.boolean().optional().describe('Whether file changes should persist'),
    timeout: z.number().optional().describe('Timeout in milliseconds'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      const result = await provider.runCommand(input.command);

      commandLogBus.emit({
        command: input.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.exitCode === 0,
        durationMs: result.durationMs,
        timestamp: result.timestamp ?? new Date(),
      });

      return JSON.stringify({
        exitCode: result.exitCode,
        stdout: result.stdout?.slice(0, 5000),
        stderr: result.stderr?.slice(0, 2000),
        success: result.exitCode === 0,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: errorMsg });
    }
  }
}

/**
 * Deploy Preview Tool
 * Deploys the current code to preview environment
 */
export class DeployPreviewTool extends StructuredTool {
  name = 'deploy_preview';
  description = 'Deploy changes to the sandbox preview environment to verify fixes';

  schema = z.object({
    clearLogs: z.boolean().optional().describe('Whether to clear logs before deploying'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    try {
      // Clear logs if requested
      if (input.clearLogs) {
        commandLogBus.clear();
      }

      // Run build
      const buildResult = await provider.runCommand('npm run build');
      
      if (buildResult.exitCode !== 0) {
        return JSON.stringify({
          success: false,
          error: 'Build failed',
          stderr: buildResult.stderr?.slice(0, 2000),
        });
      }

      // Start dev server if not running
      await provider.runCommand('npm run dev &');

      return JSON.stringify({
        success: true,
        message: 'Deployment successful',
        previewUrl:
          provider.getSandboxUrl?.() || provider.getSandboxInfo?.()?.url || 'Preview URL not available',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: errorMsg });
    }
  }
}

/**
 * Run Analysis Tool
 * Runs lint and typecheck
 */
export class RunAnalysisTool extends StructuredTool {
  name = 'run_analysis';
  description = 'Run lint and typecheck on the codebase. Fast and reliable for verification.';

  schema = z.object({
    lintOnly: z.boolean().optional().describe('Only run lint, skip typecheck'),
    typecheckOnly: z.boolean().optional().describe('Only run typecheck, skip lint'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const provider = sandboxManager.getActiveProvider();
    if (!provider) {
      return JSON.stringify({ error: 'No active sandbox provider' });
    }

    const results: Record<string, unknown> = {};

    try {
      // Run lint
      if (!input.typecheckOnly) {
        const lintResult = await provider.runCommand('npm run lint 2>&1 || true');
        results.lint = {
          success: lintResult.exitCode === 0,
          output: lintResult.stdout?.slice(0, 3000),
          errors: this.parseLintErrors(lintResult.stdout || ''),
        };
      }

      // Run typecheck
      if (!input.lintOnly) {
        const tscResult = await provider.runCommand('npx tsc --noEmit 2>&1 || true');
        results.typecheck = {
          success: tscResult.exitCode === 0,
          output: tscResult.stdout?.slice(0, 3000),
          errors: this.parseTypeErrors(tscResult.stdout || ''),
        };
      }

      const hasErrors = 
        (results.lint as any)?.errors?.length > 0 ||
        (results.typecheck as any)?.errors?.length > 0;

      return JSON.stringify({
        success: !hasErrors,
        ...results,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: errorMsg });
    }
  }

  private parseLintErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (/error|warning/i.test(line) && line.includes(':')) {
        errors.push(line.trim());
      }
    }
    
    return errors.slice(0, 20);
  }

  private parseTypeErrors(output: string): string[] {
    const errors: string[] = [];
    const errorRegex = /([^:\s]+\.tsx?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)/g;
    
    let match;
    while ((match = errorRegex.exec(output)) !== null) {
      errors.push(`${match[1]}:${match[2]}:${match[3]} - ${match[4]}`);
    }
    
    return errors.slice(0, 20);
  }
}

/**
 * Get Runtime Errors Tool
 * Retrieves recent runtime errors from the sandbox
 */
export class GetRuntimeErrorsTool extends StructuredTool {
  name = 'get_runtime_errors';
  description = 'Get recent runtime errors from the sandbox. More reliable than logs.';

  schema = z.object({
    limit: z.number().optional().describe('Maximum number of errors to return'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const limit = input.limit || 10;
    const recentLogs = commandLogBus.getRecent(50);
    
    // Filter for failed commands
    const errors = recentLogs
      .filter(log => !log.success && log.stderr)
      .slice(0, limit)
      .map(log => ({
        command: log.command,
        error: log.stderr?.slice(0, 500),
        exitCode: log.exitCode,
        timestamp: log.timestamp,
      }));

    return JSON.stringify({
      count: errors.length,
      errors,
    });
  }
}

/**
 * Get Logs Tool
 * Retrieves command logs from the sandbox
 */
export class GetLogsTool extends StructuredTool {
  name = 'get_logs';
  description = 'Get command execution logs. Use sparingly - logs are cumulative.';

  schema = z.object({
    limit: z.number().optional().describe('Maximum number of log entries'),
    reset: z.boolean().optional().describe('Clear logs before returning'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    if (input.reset) {
      commandLogBus.clear();
      return JSON.stringify({ message: 'Logs cleared', logs: [] });
    }

    const limit = input.limit || 25;
    const logs = commandLogBus.getRecent(limit);

    return JSON.stringify({
      count: logs.length,
      logs: logs.map(log => ({
        command: log.command,
        success: log.success,
        exitCode: log.exitCode,
        stdout: log.stdout?.slice(0, 500),
        stderr: log.stderr?.slice(0, 500),
        timestamp: log.timestamp,
      })),
    });
  }
}

/**
 * Wait Tool
 * Wait for a specified duration
 */
export class WaitTool extends StructuredTool {
  name = 'wait';
  description = 'Wait for a specified number of seconds. Use after deploy to allow time for user interaction.';

  schema = z.object({
    seconds: z.number().describe('Number of seconds to wait'),
    reason: z.string().optional().describe('Reason for waiting'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const ms = Math.min(input.seconds * 1000, 60000); // Max 60 seconds
    await new Promise(resolve => setTimeout(resolve, ms));
    
    return JSON.stringify({
      waited: input.seconds,
      reason: input.reason || 'Completed wait',
    });
  }
}

/**
 * Create all sandbox tools
 */
export function createSandboxTools(): StructuredTool[] {
  return [
    new RunCommandTool(),
    new DeployPreviewTool(),
    new RunAnalysisTool(),
    new GetRuntimeErrorsTool(),
    new GetLogsTool(),
    new WaitTool(),
  ];
}

export default createSandboxTools;


