/**
 * Sandbox Orchestrator Module
 * 
 * Unified coordinator for all sandbox lifecycle operations.
 * Integrates health monitoring, keep-alive, error recovery, and validation.
 */

import { sandboxConfig, SandboxState, classifyError } from '../config/sandbox-config';
import { sandboxManager } from '../sandbox-manager';
import { healthMonitor, HealthEvent, HealthCheckResult } from '../health/health-monitor';
import { keepAlive, SessionInfo } from '../lifecycle/keep-alive';
import { buildErrorHandler, RecoveryResult, BuildError } from '../recovery/build-error-handler';
import { environmentValidator, ValidationResult } from '../validation/environment-validator';
import { selfHealingSupervisor } from '../automation/self-healing-supervisor';

export interface OrchestratorStatus {
    sandboxId: string | null;
    state: SandboxState;
    health: HealthCheckResult | null;
    session: SessionInfo | null;
    lastValidation: ValidationResult | null;
    errors: BuildError[];
    recovering: boolean;
}

export interface CreateSandboxOptions {
    skipValidation?: boolean;
    onProgress?: (status: string) => void;
}

export interface ExecuteOptions {
    enableRecovery?: boolean;
    validateAfter?: boolean;
    onProgress?: (status: string) => void;
}

type OrchestratorEventListener = (event: { type: string; data: any }) => void;

/**
 * Sandbox Orchestrator
 * 
 * Main entry point for sandbox lifecycle management.
 */
class SandboxOrchestrator {
    private listeners: Set<OrchestratorEventListener> = new Set();
    private status: OrchestratorStatus = {
        sandboxId: null,
        state: 'terminated',
        health: null,
        session: null,
        lastValidation: null,
        errors: [],
        recovering: false,
    };

    constructor() {
        // Subscribe to health events
        healthMonitor.subscribe(this.handleHealthEvent.bind(this));

        // Subscribe to keep-alive events
        keepAlive.subscribe(this.handleSessionEvent.bind(this));
    }

    /**
     * Initialize the orchestrator for a provider
     */
    initialize(provider: 'vercel' | 'e2b' = 'vercel'): void {
        sandboxConfig.initialize(provider);
        selfHealingSupervisor.start();
        console.log(`[Orchestrator] Initialized for provider: ${provider}`);
        this.emitEvent('initialized', { provider });
    }

    /**
     * Create a sandbox with validation and monitoring
     */
    async createAndValidate(options: CreateSandboxOptions = {}): Promise<{
        success: boolean;
        sandboxId?: string;
        url?: string;
        error?: string;
        validation?: ValidationResult;
    }> {
        const { skipValidation = false, onProgress } = options;

        try {
            onProgress?.('Initializing sandbox creation...');
            this.status.state = 'initializing';
            this.emitEvent('creating', {});

            // Get the active provider
            const provider = sandboxManager.getActiveProvider();

            if (!provider) {
                throw new Error('No sandbox provider available');
            }

            // Get sandbox info
            const sandboxInfo = provider.getSandboxInfo();

            if (!sandboxInfo) {
                throw new Error('Failed to get sandbox info');
            }

            this.status.sandboxId = sandboxInfo.sandboxId;
            onProgress?.('Sandbox created, starting monitoring...');

            // Start health monitoring
            healthMonitor.start();

            // Validate environment if not skipped
            if (!skipValidation) {
                onProgress?.('Validating environment...');

                const validation = await environmentValidator.validate();
                this.status.lastValidation = validation;

                if (!validation.valid) {
                    // Try recovery for non-critical failures
                    onProgress?.('Validation failed, attempting recovery...');

                    const recovery = await buildErrorHandler.recover(validation.errors);

                    if (!recovery.success) {
                        return {
                            success: false,
                            sandboxId: sandboxInfo.sandboxId,
                            url: sandboxInfo.url,
                            error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
                            validation,
                        };
                    }

                    // Re-validate after recovery
                    const revalidation = await environmentValidator.validate();
                    this.status.lastValidation = revalidation;

                    if (!revalidation.valid) {
                        return {
                            success: false,
                            sandboxId: sandboxInfo.sandboxId,
                            url: sandboxInfo.url,
                            error: 'Validation failed after recovery attempt',
                            validation: revalidation,
                        };
                    }
                }
            }

            this.status.state = 'ready';
            onProgress?.('Sandbox ready!');
            this.emitEvent('ready', { sandboxId: sandboxInfo.sandboxId, url: sandboxInfo.url });

            return {
                success: true,
                sandboxId: sandboxInfo.sandboxId,
                url: sandboxInfo.url,
                validation: this.status.lastValidation || undefined,
            };

        } catch (error: any) {
            console.error('[Orchestrator] Creation failed:', error);
            this.status.state = 'terminated';
            this.emitEvent('error', { error: error.message });

            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Start a session for AI generation
     */
    startGeneration(): string {
        const sessionId = keepAlive.startSession('ai-generation');
        this.status.state = 'active';
        this.status.session = keepAlive.getSessionInfo();
        this.emitEvent('generation-started', { sessionId });
        return sessionId;
    }

    /**
     * End the current generation session
     */
    async endGeneration(options: { validate?: boolean } = {}): Promise<{
        success: boolean;
        validation?: ValidationResult;
        errors?: BuildError[];
    }> {
        keepAlive.endSession();
        this.status.session = null;

        // Optionally validate after generation
        if (options.validate) {
            const validation = await environmentValidator.validate();
            this.status.lastValidation = validation;

            if (!validation.valid) {
                this.status.errors = validation.errors;
                this.emitEvent('generation-failed', { errors: validation.errors });

                return {
                    success: false,
                    validation,
                    errors: validation.errors,
                };
            }
        }

        this.status.state = 'idle';
        this.emitEvent('generation-complete', {});

        return {
            success: true,
            validation: this.status.lastValidation || undefined,
        };
    }

    /**
     * Execute a command with automatic recovery
     */
    async executeWithRecovery<T>(
        operation: () => Promise<T>,
        options: ExecuteOptions = {}
    ): Promise<{ success: boolean; result?: T; error?: string; recovered?: boolean }> {
        const { enableRecovery = true, validateAfter = false, onProgress } = options;

        try {
            onProgress?.('Executing operation...');
            const result = await operation();

            if (validateAfter) {
                onProgress?.('Validating...');
                const validation = await environmentValidator.validate();
                this.status.lastValidation = validation;

                if (!validation.valid && enableRecovery) {
                    onProgress?.('Recovering from errors...');
                    const recovery = await this.recoverFromErrors(validation.errors);

                    if (!recovery.success) {
                        return {
                            success: false,
                            result,
                            error: 'Validation failed after operation',
                        };
                    }

                    return { success: true, result, recovered: true };
                }
            }

            return { success: true, result };

        } catch (error: any) {
            console.error('[Orchestrator] Operation failed:', error);

            if (enableRecovery) {
                const classification = classifyError(error);

                if (classification.recoverable) {
                    onProgress?.('Attempting recovery...');
                    const recovery = await buildErrorHandler.recover([{
                        type: classification.type,
                        message: classification.message,
                    }]);

                    if (recovery.success) {
                        // Retry the operation after recovery
                        try {
                            const result = await operation();
                            return { success: true, result, recovered: true };
                        } catch (retryError: any) {
                            return { success: false, error: retryError.message };
                        }
                    }
                }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Recover from detected errors
     */
    async recoverFromErrors(errors: BuildError[]): Promise<RecoveryResult> {
        this.status.recovering = true;
        this.status.errors = errors;
        this.emitEvent('recovery-started', { errors });

        try {
            const result = await buildErrorHandler.recover(errors, {
                onProgress: (attempt, strategy) => {
                    this.emitEvent('recovery-progress', { attempt, strategy });
                },
            });

            if (result.success) {
                this.status.errors = [];
                this.emitEvent('recovery-complete', { result });
            } else {
                this.emitEvent('recovery-failed', { result });
            }

            return result;

        } finally {
            this.status.recovering = false;
        }
    }

    /**
     * Ensure sandbox is ready, waiting if necessary
     */
    async ensureReady(timeoutMs: number = 30000): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            // Check health
            const health = await healthMonitor.forceCheck();
            this.status.health = health;

            if (health.healthy) {
                // Quick validation
                const isReady = await environmentValidator.quickValidate();
                if (isReady) {
                    this.status.state = 'ready';
                    return true;
                }
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return false;
    }

    /**
     * Get current orchestrator status
     */
    getStatus(): OrchestratorStatus {
        return {
            ...this.status,
            health: healthMonitor.getLastResult(),
            session: keepAlive.getSessionInfo(),
        };
    }

    /**
     * Subscribe to orchestrator events
     */
    subscribe(listener: OrchestratorEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Stop all monitoring and cleanup
     */
    shutdown(): void {
        healthMonitor.stop();
        keepAlive.endSession();
        this.status.state = 'terminated';
        this.emitEvent('shutdown', {});
    }

    /**
     * Handle health events from monitor
     */
    private handleHealthEvent(event: HealthEvent): void {
        this.status.health = event.result;

        if (event.type === 'failed') {
            this.status.state = 'unhealthy';
            this.emitEvent('health-failed', event);

            // Auto-recovery if not already in a recovery
            if (!this.status.recovering) {
                this.recoverFromErrors([{
                    type: 'connection',
                    message: event.result.error || 'Health check failed',
                }]);
            }
        } else if (event.type === 'recovered') {
            if (this.status.state === 'unhealthy') {
                this.status.state = 'ready';
            }
            this.emitEvent('health-recovered', event);
        }
    }

    /**
     * Handle session events from keep-alive
     */
    private handleSessionEvent(event: { type: string; session: SessionInfo }): void {
        this.status.session = event.session;
        this.emitEvent(`session-${event.type}`, event.session);
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(type: string, data: any): void {
        for (const listener of this.listeners) {
            try {
                listener({ type, data });
            } catch (error) {
                console.error('[Orchestrator] Error in listener:', error);
            }
        }
    }
}

// Export singleton instance
export const sandboxOrchestrator = new SandboxOrchestrator();

export default sandboxOrchestrator;
