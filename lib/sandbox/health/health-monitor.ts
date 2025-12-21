/**
 * Sandbox Health Monitor Module
 * 
 * Proactive health monitoring to detect issues before they cause 402/502 errors.
 * Runs periodic health checks and emits events on status changes.
 */

import { sandboxConfig, HealthStatus, SandboxState, classifyError } from '../config/sandbox-config';
import { sandboxManager } from '../sandbox-manager';

export interface HealthCheckResult {
    healthy: boolean;
    status: HealthStatus;
    responseTimeMs: number;
    lastCheck: Date;
    error?: string;
    details?: {
        sandboxAlive: boolean;
        commandResponsive: boolean;
        viteRunning?: boolean;
    };
}

export type HealthEventType =
    | 'healthy'
    | 'degraded'
    | 'failed'
    | 'recovering'
    | 'recovered';

export interface HealthEvent {
    type: HealthEventType;
    timestamp: Date;
    result: HealthCheckResult;
    previousStatus?: HealthStatus;
}

type HealthEventListener = (event: HealthEvent) => void;

/**
 * Sandbox Health Monitor
 * 
 * Monitors sandbox health with periodic checks and emits events on status changes.
 */
class SandboxHealthMonitor {
    private isRunning: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private lastResult: HealthCheckResult | null = null;
    private consecutiveFailures: number = 0;
    private listeners: Set<HealthEventListener> = new Set();
    private currentState: SandboxState = 'terminated';

    // Thresholds for status transitions
    private static readonly DEGRADED_THRESHOLD = 2; // Failures before degraded
    private static readonly FAILED_THRESHOLD = 3;   // Failures before failed

    /**
     * Start health monitoring
     */
    start(): void {
        if (this.isRunning) {
            console.log('[HealthMonitor] Already running');
            return;
        }

        const config = sandboxConfig.getConfig();
        this.isRunning = true;
        this.currentState = 'ready';
        this.consecutiveFailures = 0;

        console.log(`[HealthMonitor] Starting with interval: ${config.healthCheckIntervalMs}ms`);

        // Perform initial check
        this.performCheck();

        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.performCheck();
        }, config.healthCheckIntervalMs);
    }

    /**
     * Stop health monitoring
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        console.log('[HealthMonitor] Stopping');
        this.isRunning = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.currentState = 'terminated';
    }

    /**
     * Force an immediate health check
     */
    async forceCheck(): Promise<HealthCheckResult> {
        return this.performCheck();
    }

    /**
     * Subscribe to health events
     */
    subscribe(listener: HealthEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Get the last health check result
     */
    getLastResult(): HealthCheckResult | null {
        return this.lastResult ? { ...this.lastResult } : null;
    }

    /**
     * Get current sandbox state
     */
    getState(): SandboxState {
        return this.currentState;
    }

    /**
     * Set sandbox state (used by other modules)
     */
    setState(state: SandboxState): void {
        this.currentState = state;
        console.log(`[HealthMonitor] State changed to: ${state}`);
    }

    /**
     * Check if sandbox is currently healthy
     */
    isHealthy(): boolean {
        return this.lastResult?.healthy === true;
    }

    /**
     * Perform a health check
     */
    private async performCheck(): Promise<HealthCheckResult> {
        const startTime = Date.now();

        try {
            const provider = sandboxManager.getActiveProvider();

            if (!provider) {
                const result = this.createResult(false, 'failed', Date.now() - startTime, {
                    error: 'No active sandbox provider',
                    details: { sandboxAlive: false, commandResponsive: false },
                });
                this.handleResult(result);
                return result;
            }

            // Check 1: Is the sandbox instance alive?
            const sandboxAlive = provider.isAlive();

            if (!sandboxAlive) {
                const result = this.createResult(false, 'failed', Date.now() - startTime, {
                    error: 'Sandbox is not alive',
                    details: { sandboxAlive: false, commandResponsive: false },
                });
                this.handleResult(result);
                return result;
            }

            // Check 2: Can we execute a simple command?
            let commandResponsive = false;
            try {
                const cmdResult = await provider.runCommand('echo "health-check"');
                commandResponsive = cmdResult.success && cmdResult.stdout.includes('health-check');
            } catch (error) {
                console.log('[HealthMonitor] Command check failed:', error);
                commandResponsive = false;
            }

            if (!commandResponsive) {
                const result = this.createResult(false, 'degraded', Date.now() - startTime, {
                    error: 'Sandbox not responding to commands',
                    details: { sandboxAlive: true, commandResponsive: false },
                });
                this.handleResult(result);
                return result;
            }

            // Check 3: Is Vite running? (optional, non-blocking)
            let viteRunning = false;
            try {
                const psResult = await provider.runCommand('pgrep -f vite || echo "no-vite"');
                viteRunning = psResult.success && !psResult.stdout.includes('no-vite');
            } catch {
                // Vite check is non-blocking
                viteRunning = false;
            }

            // All critical checks passed
            const result = this.createResult(true, 'healthy', Date.now() - startTime, {
                details: { sandboxAlive: true, commandResponsive: true, viteRunning },
            });
            this.handleResult(result);
            return result;

        } catch (error: any) {
            const classification = classifyError(error);
            const result = this.createResult(false, 'failed', Date.now() - startTime, {
                error: classification.message,
                details: { sandboxAlive: false, commandResponsive: false },
            });
            this.handleResult(result);
            return result;
        }
    }

    /**
     * Create a health check result
     */
    private createResult(
        healthy: boolean,
        status: HealthStatus,
        responseTimeMs: number,
        extra?: { error?: string; details?: HealthCheckResult['details'] }
    ): HealthCheckResult {
        return {
            healthy,
            status,
            responseTimeMs,
            lastCheck: new Date(),
            ...extra,
        };
    }

    /**
     * Handle a health check result and emit events
     */
    private handleResult(result: HealthCheckResult): void {
        const previousResult = this.lastResult;
        const previousStatus = previousResult?.status;
        this.lastResult = result;

        // Track consecutive failures
        if (!result.healthy) {
            this.consecutiveFailures++;
        } else {
            this.consecutiveFailures = 0;
        }

        // Determine event type based on status transition
        let eventType: HealthEventType | null = null;

        if (result.status !== previousStatus) {
            switch (result.status) {
                case 'healthy':
                    eventType = previousStatus === 'failed' ? 'recovered' : 'healthy';
                    this.currentState = 'ready';
                    break;
                case 'degraded':
                    eventType = 'degraded';
                    this.currentState = 'unhealthy';
                    break;
                case 'failed':
                    eventType = 'failed';
                    this.currentState = 'unhealthy';
                    break;
            }
        }

        // Emit event if status changed
        if (eventType) {
            const event: HealthEvent = {
                type: eventType,
                timestamp: new Date(),
                result,
                previousStatus,
            };

            console.log(`[HealthMonitor] Status change: ${previousStatus || 'unknown'} -> ${result.status}`);
            this.emitEvent(event);
        }
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(event: HealthEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('[HealthMonitor] Error in listener:', error);
            }
        }
    }
}

// Export singleton instance
export const healthMonitor = new SandboxHealthMonitor();

export default healthMonitor;
