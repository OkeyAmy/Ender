/**
 * Sandbox Configuration Module
 * 
 * Central configuration for sandbox lifecycle management.
 * Optimized for free tier constraints while maximizing availability.
 */

export interface SandboxConfigOptions {
    /** Sandbox timeout in milliseconds - respects provider limits */
    timeoutMs: number;

    /** Health check interval in milliseconds */
    healthCheckIntervalMs: number;

    /** Keep-alive heartbeat interval in milliseconds */
    keepAliveIntervalMs: number;

    /** Maximum retry attempts for recoverable errors */
    maxRetryAttempts: number;

    /** Maximum time to spend on error recovery (ms) */
    recoveryTimeoutMs: number;

    /** Delay before retrying after a failure (ms) */
    retryDelayMs: number;

    /** Time before sandbox is considered idle (ms) */
    idleTimeoutMs: number;

    /** Grace period after last activity before cleanup (ms) */
    gracePeriodMs: number;
}

/**
 * Provider-specific limits for free tier
 */
export const PROVIDER_LIMITS = {
    vercel: {
        // Vercel free tier: 5 minutes max per sandbox session
        maxTimeoutMs: 5 * 60 * 1000,
        // Can create new sandboxes, so we optimize for quick recovery
        supportsRecreate: true,
    },
    e2b: {
        // E2B free tier: 15 minutes max per sandbox session  
        maxTimeoutMs: 15 * 60 * 1000,
        // E2B supports sandbox reconnection
        supportsReconnect: true,
    },
} as const;

/**
 * Default configuration optimized for free tier constraints
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfigOptions = {
    // Use maximum allowed by provider (set dynamically)
    timeoutMs: PROVIDER_LIMITS.vercel.maxTimeoutMs,

    // Check health every 30 seconds - balances responsiveness with overhead
    healthCheckIntervalMs: 30 * 1000,

    // Send heartbeat every 15 seconds during active operations
    // This prevents the sandbox from being considered "idle"
    keepAliveIntervalMs: 15 * 1000,

    // Try up to 3 times for recoverable errors
    maxRetryAttempts: 3,

    // Spend up to 30 seconds trying to recover from errors
    recoveryTimeoutMs: 30 * 1000,

    // Wait 2 seconds between retry attempts
    retryDelayMs: 2000,

    // Consider sandbox idle after 2 minutes of no activity
    idleTimeoutMs: 2 * 60 * 1000,

    // Keep sandbox alive 30 seconds after last activity
    gracePeriodMs: 30 * 1000,
};

/**
 * Sandbox lifecycle states
 */
export type SandboxState =
    | 'initializing'   // Sandbox is being created
    | 'ready'          // Sandbox is healthy and ready
    | 'active'         // Active AI generation in progress
    | 'idle'           // No active operations
    | 'recovering'     // Error recovery in progress
    | 'unhealthy'      // Health check failed
    | 'terminated';    // Sandbox has been stopped

/**
 * Health status levels
 */
export type HealthStatus =
    | 'healthy'        // All systems operational
    | 'degraded'       // Some issues but functional
    | 'failed';        // Not responding

/**
 * Error classification for recovery decisions
 */
export type ErrorType =
    | 'timeout'        // Sandbox timed out
    | 'connection'     // Network/connection issue (402, 502, 503)
    | 'build'          // Build/compilation error
    | 'install'        // Package installation failure
    | 'runtime'        // Runtime execution error
    | 'fatal';         // Unrecoverable error

export interface ErrorClassification {
    type: ErrorType;
    recoverable: boolean;
    message: string;
    originalError?: Error;
}

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(provider: 'vercel' | 'e2b'): SandboxConfigOptions {
    const limits = PROVIDER_LIMITS[provider];

    return {
        ...DEFAULT_SANDBOX_CONFIG,
        // Use the provider's maximum allowed timeout
        timeoutMs: limits.maxTimeoutMs,
    };
}

/**
 * Classify an error for recovery decisions
 */
export function classifyError(error: Error | string): ErrorClassification {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    // Timeout errors
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
        return {
            type: 'timeout',
            recoverable: true,
            message: 'Sandbox operation timed out',
            originalError: error instanceof Error ? error : undefined,
        };
    }

    // Connection errors (402, 502, 503, etc.)
    if (
        lowerMessage.includes('402') ||
        lowerMessage.includes('502') ||
        lowerMessage.includes('503') ||
        lowerMessage.includes('no longer reachable') ||
        lowerMessage.includes('stopped') ||
        lowerMessage.includes('connection')
    ) {
        return {
            type: 'connection',
            recoverable: true,
            message: 'Sandbox connection lost',
            originalError: error instanceof Error ? error : undefined,
        };
    }

    // Package installation errors
    if (
        lowerMessage.includes('npm') ||
        lowerMessage.includes('package') ||
        lowerMessage.includes('install') ||
        lowerMessage.includes('enoent') ||
        lowerMessage.includes('module not found')
    ) {
        return {
            type: 'install',
            recoverable: true,
            message: 'Package installation failed',
            originalError: error instanceof Error ? error : undefined,
        };
    }

    // Build errors
    if (
        lowerMessage.includes('build') ||
        lowerMessage.includes('compile') ||
        lowerMessage.includes('syntax error') ||
        lowerMessage.includes('vite')
    ) {
        return {
            type: 'build',
            recoverable: true,
            message: 'Build error detected',
            originalError: error instanceof Error ? error : undefined,
        };
    }

    // Runtime errors
    if (
        lowerMessage.includes('runtime') ||
        lowerMessage.includes('execution') ||
        lowerMessage.includes('crashed')
    ) {
        return {
            type: 'runtime',
            recoverable: true,
            message: 'Runtime error occurred',
            originalError: error instanceof Error ? error : undefined,
        };
    }

    // Default to fatal for unknown errors
    return {
        type: 'fatal',
        recoverable: false,
        message: message,
        originalError: error instanceof Error ? error : undefined,
    };
}

/**
 * Singleton configuration instance
 */
class SandboxConfigManager {
    private config: SandboxConfigOptions = DEFAULT_SANDBOX_CONFIG;
    private provider: 'vercel' | 'e2b' = 'vercel';

    /**
     * Initialize configuration for a specific provider
     */
    initialize(provider: 'vercel' | 'e2b'): void {
        this.provider = provider;
        this.config = getProviderConfig(provider);
        console.log(`[SandboxConfig] Initialized for ${provider} with timeout: ${this.config.timeoutMs}ms`);
    }

    /**
     * Get current configuration
     */
    getConfig(): SandboxConfigOptions {
        return { ...this.config };
    }

    /**
     * Get current provider
     */
    getProvider(): 'vercel' | 'e2b' {
        return this.provider;
    }

    /**
     * Update specific configuration values
     */
    updateConfig(updates: Partial<SandboxConfigOptions>): void {
        this.config = { ...this.config, ...updates };
    }

    /**
     * Get provider limits
     */
    getProviderLimits() {
        return PROVIDER_LIMITS[this.provider];
    }
}

// Export singleton instance
export const sandboxConfig = new SandboxConfigManager();

export default sandboxConfig;
