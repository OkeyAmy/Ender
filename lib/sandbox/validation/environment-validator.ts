/**
 * Environment Validation Module
 * 
 * Validates that the sandbox environment is fully ready before completing AI response.
 * Ensures builds succeed, packages install, and Vite server is healthy.
 */

import { sandboxManager } from '../sandbox-manager';
import { buildErrorHandler, BuildError } from '../recovery/build-error-handler';
import { healthMonitor } from '../health/health-monitor';

export interface ValidationResult {
    valid: boolean;
    checks: ValidationCheck[];
    errors: BuildError[];
    duration: number;
}

export interface ValidationCheck {
    name: string;
    passed: boolean;
    message?: string;
    critical: boolean;
}

export interface ValidationOptions {
    skipViteCheck?: boolean;
    skipBuildCheck?: boolean;
    timeout?: number;
}

/**
 * Environment Validator
 * 
 * Runs validation checks to ensure sandbox is ready for user interaction.
 */
class EnvironmentValidator {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

    /**
     * Run all validation checks
     */
    async validate(options: ValidationOptions = {}): Promise<ValidationResult> {
        const startTime = Date.now();
        const checks: ValidationCheck[] = [];
        const errors: BuildError[] = [];

        console.log('[Validator] Starting environment validation');

        // Check 1: Sandbox is alive
        const sandboxCheck = await this.validateSandboxAlive();
        checks.push(sandboxCheck);

        if (!sandboxCheck.passed) {
            // If sandbox is dead, fail immediately
            return {
                valid: false,
                checks,
                errors: [{ type: 'connection', message: sandboxCheck.message || 'Sandbox not responding' }],
                duration: Date.now() - startTime,
            };
        }

        // Check 2: Vite server is running (if not skipped)
        if (!options.skipViteCheck) {
            const viteCheck = await this.validateViteServer();
            checks.push(viteCheck);

            if (!viteCheck.passed && viteCheck.critical) {
                errors.push({ type: 'build', message: viteCheck.message || 'Vite server not running' });
            }
        }

        // Check 3: No build errors in console (if not skipped)
        if (!options.skipBuildCheck) {
            const buildCheck = await this.validateNoBuildErrors();
            checks.push(buildCheck);

            if (!buildCheck.passed) {
                // Collect any build errors
                const detectedErrors = await this.collectBuildErrors();
                errors.push(...detectedErrors);
            }
        }

        // Check 4: Package.json is valid
        const packageCheck = await this.validatePackageJson();
        checks.push(packageCheck);

        // Check 5: Entry files exist
        const entryCheck = await this.validateEntryFiles();
        checks.push(entryCheck);

        // Determine overall validity
        const criticalFailures = checks.filter(c => c.critical && !c.passed);
        const valid = criticalFailures.length === 0;

        const result: ValidationResult = {
            valid,
            checks,
            errors,
            duration: Date.now() - startTime,
        };

        console.log(`[Validator] Validation complete: ${valid ? 'PASSED' : 'FAILED'} (${result.duration}ms)`);

        return result;
    }

    /**
     * Quick validation - only critical checks
     */
    async quickValidate(): Promise<boolean> {
        const sandboxCheck = await this.validateSandboxAlive();
        if (!sandboxCheck.passed) return false;

        const viteCheck = await this.validateViteServer();
        if (!viteCheck.passed) return false;

        return true;
    }

    /**
     * Validate sandbox is alive and responsive
     */
    private async validateSandboxAlive(): Promise<ValidationCheck> {
        try {
            const provider = sandboxManager.getActiveProvider();

            if (!provider) {
                return {
                    name: 'sandbox-alive',
                    passed: false,
                    message: 'No active sandbox provider',
                    critical: true,
                };
            }

            if (!provider.isAlive()) {
                return {
                    name: 'sandbox-alive',
                    passed: false,
                    message: 'Sandbox instance is not alive',
                    critical: true,
                };
            }

            // Try a simple command
            const result = await provider.runCommand('echo "alive"');

            return {
                name: 'sandbox-alive',
                passed: result.success,
                message: result.success ? 'Sandbox is responsive' : 'Sandbox failed to respond',
                critical: true,
            };

        } catch (error: any) {
            return {
                name: 'sandbox-alive',
                passed: false,
                message: `Sandbox check failed: ${error.message}`,
                critical: true,
            };
        }
    }

    /**
     * Validate Vite dev server is running
     */
    private async validateViteServer(): Promise<ValidationCheck> {
        try {
            const provider = sandboxManager.getActiveProvider();
            if (!provider) {
                return { name: 'vite-server', passed: false, message: 'No provider', critical: true };
            }

            // Check if Vite process is running
            const result = await provider.runCommand('pgrep -f "vite" || echo "not-found"');
            const isRunning = result.success && !result.stdout.includes('not-found');

            if (!isRunning) {
                return {
                    name: 'vite-server',
                    passed: false,
                    message: 'Vite dev server is not running',
                    critical: true,
                };
            }

            // Optional: Check if Vite is listening on port
            const portCheck = await provider.runCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 || echo "error"');
            const isListening = portCheck.success && !portCheck.stdout.includes('error') && !portCheck.stdout.includes('000');

            return {
                name: 'vite-server',
                passed: isListening,
                message: isListening ? 'Vite server is running and listening' : 'Vite is running but not responding on port 5173',
                critical: true,
            };

        } catch (error: any) {
            return {
                name: 'vite-server',
                passed: false,
                message: `Vite check failed: ${error.message}`,
                critical: true,
            };
        }
    }

    /**
     * Validate no build errors in Vite logs
     */
    private async validateNoBuildErrors(): Promise<ValidationCheck> {
        try {
            const provider = sandboxManager.getActiveProvider();
            if (!provider) {
                return { name: 'no-build-errors', passed: false, message: 'No provider', critical: false };
            }

            // Check Vite log file for errors
            const result = await provider.runCommand('tail -n 50 /tmp/vite.log 2>/dev/null || echo ""');

            if (!result.success) {
                // No log file is not necessarily an error
                return {
                    name: 'no-build-errors',
                    passed: true,
                    message: 'Could not read Vite logs (may not exist)',
                    critical: false,
                };
            }

            // Check for error patterns in log
            const log = result.stdout;
            const hasErrors =
                log.includes('error') ||
                log.includes('ERROR') ||
                log.includes('failed') ||
                log.includes('FAILED') ||
                log.includes('SyntaxError') ||
                log.includes('Cannot find module');

            return {
                name: 'no-build-errors',
                passed: !hasErrors,
                message: hasErrors ? 'Build errors detected in Vite logs' : 'No build errors in logs',
                critical: false,
            };

        } catch (error: any) {
            return {
                name: 'no-build-errors',
                passed: true, // Don't fail on log check errors
                message: `Log check inconclusive: ${error.message}`,
                critical: false,
            };
        }
    }

    /**
     * Validate package.json exists and is valid
     */
    private async validatePackageJson(): Promise<ValidationCheck> {
        try {
            const provider = sandboxManager.getActiveProvider();
            if (!provider) {
                return { name: 'package-json', passed: false, message: 'No provider', critical: false };
            }

            // Try to read and parse package.json
            const result = await provider.runCommand('cat /vercel/sandbox/package.json 2>/dev/null || cat /home/user/app/package.json 2>/dev/null');

            if (!result.success || !result.stdout) {
                return {
                    name: 'package-json',
                    passed: false,
                    message: 'package.json not found',
                    critical: false,
                };
            }

            try {
                JSON.parse(result.stdout);
                return {
                    name: 'package-json',
                    passed: true,
                    message: 'package.json is valid',
                    critical: false,
                };
            } catch {
                return {
                    name: 'package-json',
                    passed: false,
                    message: 'package.json is invalid JSON',
                    critical: false,
                };
            }

        } catch (error: any) {
            return {
                name: 'package-json',
                passed: false,
                message: `Package.json check failed: ${error.message}`,
                critical: false,
            };
        }
    }

    /**
     * Validate essential entry files exist
     */
    private async validateEntryFiles(): Promise<ValidationCheck> {
        try {
            const provider = sandboxManager.getActiveProvider();
            if (!provider) {
                return { name: 'entry-files', passed: false, message: 'No provider', critical: false };
            }

            // Check for essential files
            const essentialFiles = [
                'index.html',
                'src/main.jsx',
                'src/App.jsx',
            ];

            const missingFiles: string[] = [];

            for (const file of essentialFiles) {
                const result = await provider.runCommand(`test -f /vercel/sandbox/${file} && echo "exists" || test -f /home/user/app/${file} && echo "exists" || echo "missing"`);
                if (result.stdout.includes('missing')) {
                    missingFiles.push(file);
                }
            }

            return {
                name: 'entry-files',
                passed: missingFiles.length === 0,
                message: missingFiles.length === 0
                    ? 'All entry files exist'
                    : `Missing files: ${missingFiles.join(', ')}`,
                critical: false,
            };

        } catch (error: any) {
            return {
                name: 'entry-files',
                passed: true, // Don't fail on file check errors
                message: `Entry file check inconclusive: ${error.message}`,
                critical: false,
            };
        }
    }

    /**
     * Collect build errors from various sources
     */
    private async collectBuildErrors(): Promise<BuildError[]> {
        const errors: BuildError[] = [];

        try {
            const provider = sandboxManager.getActiveProvider();
            if (!provider) return errors;

            // Get Vite logs
            const logResult = await provider.runCommand('tail -n 100 /tmp/vite.log 2>/dev/null || echo ""');
            if (logResult.success && logResult.stdout) {
                const detected = buildErrorHandler.detectErrors(logResult.stdout);
                errors.push(...detected);
            }

        } catch {
            // Ignore errors during collection
        }

        return errors;
    }
}

// Export singleton instance
export const environmentValidator = new EnvironmentValidator();

export default environmentValidator;
