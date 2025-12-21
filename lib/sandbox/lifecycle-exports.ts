/**
 * Sandbox Module Exports
 * 
 * Central export for all sandbox lifecycle modules.
 */

// Configuration
export {
    sandboxConfig,
    classifyError,
    getProviderConfig,
    DEFAULT_SANDBOX_CONFIG,
    PROVIDER_LIMITS,
    type SandboxConfigOptions,
    type SandboxState,
    type HealthStatus,
    type ErrorType,
    type ErrorClassification,
} from './config/sandbox-config';

// Health Monitoring
export {
    healthMonitor,
    type HealthCheckResult,
    type HealthEvent,
    type HealthEventType,
} from './health/health-monitor';

// Keep-Alive
export {
    keepAlive,
    type SessionInfo,
} from './lifecycle/keep-alive';

// Error Recovery
export {
    buildErrorHandler,
    type BuildError,
    type RecoveryResult,
    type RecoveryStrategy,
    type RecoveryOptions,
} from './recovery/build-error-handler';

// Environment Validation
export {
    environmentValidator,
    type ValidationResult,
    type ValidationCheck,
    type ValidationOptions,
} from './validation/environment-validator';

// Orchestrator
export {
    sandboxOrchestrator,
    type OrchestratorStatus,
    type CreateSandboxOptions,
    type ExecuteOptions,
} from './orchestrator/sandbox-orchestrator';
