/**
 * Build Error Recovery Module
 * 
 * Detects and recovers from build, installation, and runtime errors.
 * Implements retry strategies and coordinates with AI for intelligent fixes.
 */

import { sandboxConfig, classifyError, ErrorClassification, ErrorType } from '../config/sandbox-config';
import { sandboxManager } from '../sandbox-manager';
import { healthMonitor } from '../health/health-monitor';

export interface BuildError {
    type: ErrorType;
    message: string;
    file?: string;
    line?: number;
    column?: number;
    suggestion?: string;
    raw?: string;
}

export interface RecoveryResult {
    success: boolean;
    attemptsMade: number;
    finalError?: string;
    recoveredVia?: 'retry' | 'cache-clear' | 'vite-restart' | 'ai-fix';
    duration: number;
}

export type RecoveryStrategy =
    | 'retry'           // Simple retry
    | 'clear-cache'     // Clear npm cache and retry
    | 'restart-vite'    // Restart Vite dev server
    | 'reinstall'       // Reinstall packages
    | 'request-ai-fix'; // Request AI to fix the code

export interface RecoveryOptions {
    maxAttempts?: number;
    timeout?: number;
    strategies?: RecoveryStrategy[];
    onProgress?: (attempt: number, strategy: RecoveryStrategy) => void;
}

// Error patterns for detection
const ERROR_PATTERNS = {
    // NPM/Package errors
    npmError: /npm ERR!|npm error|ENOENT|ENOTFOUND|Module not found/i,
    missingPackage: /Cannot find module ['"]([^'"]+)['"]/,
    peerDependency: /peer dep|peer dependency|ERESOLVE/i,

    // Vite/Build errors
    viteError: /\[vite\]|vite error|\[plugin:.*\]/i,
    buildFailed: /Build failed|Failed to compile|Compilation failed/i,
    syntaxError: /SyntaxError|Unexpected token|Parse error/i,

    // Import errors
    importError: /Cannot find module|Unable to resolve|Failed to resolve/i,
    exportError: /does not provide an export named|Module .* does not provide/i,

    // Runtime errors
    runtimeError: /TypeError|ReferenceError|RangeError|Error:/i,
    reactError: /Invalid hook call|Rendered fewer hooks|Element type is invalid/i,

    // Connection errors
    connectionError: /ECONNREFUSED|ETIMEDOUT|connect ECONNREFUSED|socket hang up/i,
    sandboxError: /no longer reachable|sandbox.*stopped|402|502|503/i,
};

/**
 * Build Error Handler
 * 
 * Detects and recovers from various error types with intelligent retry strategies.
 */
class BuildErrorHandler {
    private isRecovering: boolean = false;
    private currentRecovery: Promise<RecoveryResult> | null = null;

    /**
     * Detect errors from sandbox output
     */
    detectErrors(output: string): BuildError[] {
        const errors: BuildError[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            // Check for missing package
            const missingPackageMatch = line.match(ERROR_PATTERNS.missingPackage);
            if (missingPackageMatch) {
                errors.push({
                    type: 'install',
                    message: `Missing package: ${missingPackageMatch[1]}`,
                    suggestion: `Install with: npm install ${missingPackageMatch[1]}`,
                    raw: line,
                });
                continue;
            }

            // Check for npm errors
            if (ERROR_PATTERNS.npmError.test(line)) {
                errors.push({
                    type: 'install',
                    message: this.extractErrorMessage(line),
                    raw: line,
                });
                continue;
            }

            // Check for Vite errors
            if (ERROR_PATTERNS.viteError.test(line)) {
                errors.push({
                    type: 'build',
                    message: this.extractErrorMessage(line),
                    raw: line,
                });
                continue;
            }

            // Check for syntax errors
            if (ERROR_PATTERNS.syntaxError.test(line)) {
                const locationMatch = line.match(/at (\S+):(\d+):(\d+)/);
                errors.push({
                    type: 'build',
                    message: this.extractErrorMessage(line),
                    file: locationMatch?.[1],
                    line: locationMatch?.[2] ? parseInt(locationMatch[2]) : undefined,
                    column: locationMatch?.[3] ? parseInt(locationMatch[3]) : undefined,
                    raw: line,
                });
                continue;
            }

            // Check for connection errors (sandbox died)
            if (ERROR_PATTERNS.sandboxError.test(line) || ERROR_PATTERNS.connectionError.test(line)) {
                errors.push({
                    type: 'connection',
                    message: 'Sandbox connection error',
                    raw: line,
                });
                continue;
            }
        }

        return errors;
    }

    /**
     * Extract a clean error message from a raw error line
     */
    private extractErrorMessage(line: string): string {
        // Remove common prefixes
        let message = line
            .replace(/^\[.*?\]\s*/, '')
            .replace(/^npm ERR!\s*/i, '')
            .replace(/^Error:\s*/i, '')
            .trim();

        // Truncate if too long
        if (message.length > 200) {
            message = message.substring(0, 200) + '...';
        }

        return message || 'Unknown error';
    }

    /**
     * Attempt to recover from errors
     */
    async recover(errors: BuildError[], options: RecoveryOptions = {}): Promise<RecoveryResult> {
        if (this.isRecovering) {
            console.log('[ErrorHandler] Recovery already in progress');
            return this.currentRecovery!;
        }

        const config = sandboxConfig.getConfig();
        const maxAttempts = options.maxAttempts ?? config.maxRetryAttempts;
        const timeout = options.timeout ?? config.recoveryTimeoutMs;
        const strategies = options.strategies ?? this.determineStrategies(errors);

        this.isRecovering = true;
        healthMonitor.setState('recovering');

        const startTime = Date.now();
        let attemptsMade = 0;
        let lastError: string | undefined;

        console.log(`[ErrorHandler] Starting recovery with strategies: ${strategies.join(', ')}`);

        this.currentRecovery = (async (): Promise<RecoveryResult> => {
            try {
                for (const strategy of strategies) {
                    if (Date.now() - startTime > timeout) {
                        console.log('[ErrorHandler] Recovery timeout reached');
                        break;
                    }

                    if (attemptsMade >= maxAttempts) {
                        console.log('[ErrorHandler] Max attempts reached');
                        break;
                    }

                    attemptsMade++;
                    options.onProgress?.(attemptsMade, strategy);
                    console.log(`[ErrorHandler] Attempt ${attemptsMade}: ${strategy}`);

                    try {
                        const success = await this.executeStrategy(strategy, errors);
                        if (success) {
                            console.log(`[ErrorHandler] Recovery successful via: ${strategy}`);
                            return {
                                success: true,
                                attemptsMade,
                                recoveredVia: strategy as RecoveryResult['recoveredVia'],
                                duration: Date.now() - startTime,
                            };
                        }
                    } catch (error: any) {
                        lastError = error.message;
                        console.log(`[ErrorHandler] Strategy ${strategy} failed:`, error.message);
                    }

                    // Wait before next attempt
                    await this.delay(config.retryDelayMs);
                }

                return {
                    success: false,
                    attemptsMade,
                    finalError: lastError || 'All recovery strategies exhausted',
                    duration: Date.now() - startTime,
                };

            } finally {
                this.isRecovering = false;
                this.currentRecovery = null;
                healthMonitor.setState('ready');
            }
        })();

        return this.currentRecovery;
    }

    /**
     * Determine the best strategies based on error types
     */
    private determineStrategies(errors: BuildError[]): RecoveryStrategy[] {
        const strategies: RecoveryStrategy[] = [];
        const errorTypes = new Set(errors.map(e => e.type));

        // Connection errors: try restart first
        if (errorTypes.has('connection') || errorTypes.has('timeout')) {
            strategies.push('restart-vite');
        }

        // Installation errors: clear cache and reinstall
        if (errorTypes.has('install')) {
            strategies.push('clear-cache', 'reinstall');
        }

        // Build errors: restart vite, then request AI fix
        if (errorTypes.has('build')) {
            strategies.push('restart-vite', 'request-ai-fix');
        }

        // Runtime errors: request AI fix
        if (errorTypes.has('runtime')) {
            strategies.push('request-ai-fix');
        }

        // Always include simple retry at the start
        if (!strategies.includes('retry')) {
            strategies.unshift('retry');
        }

        return strategies;
    }

    /**
     * Execute a specific recovery strategy
     */
    private async executeStrategy(strategy: RecoveryStrategy, errors: BuildError[]): Promise<boolean> {
        const provider = sandboxManager.getActiveProvider();

        if (!provider) {
            throw new Error('No active sandbox provider');
        }

        switch (strategy) {
            case 'retry':
                // Simple retry - just check if sandbox is responsive
                const result = await provider.runCommand('echo "retry-check"');
                return result.success;

            case 'clear-cache':
                // Clear npm cache
                await provider.runCommand('npm cache clean --force');
                return true;

            case 'restart-vite':
                // Restart Vite dev server
                try {
                    await provider.restartViteServer();
                    // Wait for Vite to stabilize
                    await this.delay(5000);
                    return true;
                } catch {
                    return false;
                }

            case 'reinstall':
                // Reinstall node_modules
                await provider.runCommand('rm -rf node_modules');
                const installResult = await provider.runCommand('npm install --legacy-peer-deps');
                return installResult.success;

            case 'request-ai-fix':
                // This strategy returns false to indicate AI intervention is needed
                // The caller should prompt the AI to fix the error
                console.log('[ErrorHandler] AI intervention required for:', errors);
                return false;

            default:
                return false;
        }
    }

    /**
     * Check if recovery is currently in progress
     */
    isRecoveryInProgress(): boolean {
        return this.isRecovering;
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format errors for AI prompt
     */
    formatErrorsForAI(errors: BuildError[]): string {
        if (errors.length === 0) return 'No errors detected';

        return errors.map((e, i) => {
            let errorStr = `Error ${i + 1}: [${e.type}] ${e.message}`;
            if (e.file) errorStr += `\n  File: ${e.file}`;
            if (e.line) errorStr += `, Line: ${e.line}`;
            if (e.suggestion) errorStr += `\n  Suggestion: ${e.suggestion}`;
            return errorStr;
        }).join('\n\n');
    }
}

// Export singleton instance
export const buildErrorHandler = new BuildErrorHandler();

export default buildErrorHandler;
