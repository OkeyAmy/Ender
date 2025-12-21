/**
 * Sandbox Keep-Alive Module
 * 
 * Ensures sandbox remains active during AI generation by sending periodic heartbeats.
 * Prevents idle timeout while user has an active request in progress.
 */

import { sandboxConfig } from '../config/sandbox-config';
import { sandboxManager } from '../sandbox-manager';
import { healthMonitor } from '../health/health-monitor';

export interface SessionInfo {
    sessionId: string;
    startedAt: Date;
    lastActivity: Date;
    type: 'idle' | 'user-prompt' | 'ai-generation' | 'code-application';
    heartbeatCount: number;
}

type SessionEventListener = (event: { type: string; session: SessionInfo }) => void;

/**
 * Sandbox Keep-Alive Service
 * 
 * Maintains sandbox availability during active operations by:
 * 1. Tracking session state (when user sends prompt, AI is generating, etc.)
 * 2. Sending periodic heartbeat commands to prevent idle timeout
 * 3. Coordinating with health monitor for recovery
 */
class SandboxKeepAlive {
    private isSessionActive: boolean = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private sessionInfo: SessionInfo | null = null;
    private listeners: Set<SessionEventListener> = new Set();

    /**
     * Start a keep-alive session when user sends a prompt
     */
    startSession(type: SessionInfo['type'] = 'user-prompt'): string {
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        this.sessionInfo = {
            sessionId,
            startedAt: new Date(),
            lastActivity: new Date(),
            type,
            heartbeatCount: 0,
        };

        this.isSessionActive = true;
        console.log(`[KeepAlive] Session started: ${sessionId} (${type})`);

        // Update health monitor state
        healthMonitor.setState('active');

        // Start heartbeat
        this.startHeartbeat();

        // Emit event
        this.emitEvent('session-started', this.sessionInfo);

        return sessionId;
    }

    /**
     * Update session type (e.g., from user-prompt to ai-generation)
     */
    updateSessionType(type: SessionInfo['type']): void {
        if (this.sessionInfo) {
            this.sessionInfo.type = type;
            this.sessionInfo.lastActivity = new Date();
            console.log(`[KeepAlive] Session type updated to: ${type}`);
            this.emitEvent('session-updated', this.sessionInfo);
        }
    }

    /**
     * Record activity to extend session
     */
    recordActivity(): void {
        if (this.sessionInfo) {
            this.sessionInfo.lastActivity = new Date();
        }
    }

    /**
     * End the keep-alive session
     */
    endSession(): void {
        if (!this.isSessionActive) {
            return;
        }

        console.log(`[KeepAlive] Session ended: ${this.sessionInfo?.sessionId}`);

        this.stopHeartbeat();
        this.isSessionActive = false;

        // Update health monitor state
        healthMonitor.setState('idle');

        // Emit event before clearing session
        if (this.sessionInfo) {
            this.emitEvent('session-ended', this.sessionInfo);
        }

        this.sessionInfo = null;
    }

    /**
     * Check if a session is currently active
     */
    isActive(): boolean {
        return this.isSessionActive;
    }

    /**
     * Get current session info
     */
    getSessionInfo(): SessionInfo | null {
        return this.sessionInfo ? { ...this.sessionInfo } : null;
    }

    /**
     * Subscribe to session events
     */
    subscribe(listener: SessionEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Start the heartbeat interval
     */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            return; // Already running
        }

        const config = sandboxConfig.getConfig();
        console.log(`[KeepAlive] Starting heartbeat with interval: ${config.keepAliveIntervalMs}ms`);

        // Send immediate heartbeat
        this.sendHeartbeat();

        // Schedule periodic heartbeats
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, config.keepAliveIntervalMs);
    }

    /**
     * Stop the heartbeat interval
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('[KeepAlive] Heartbeat stopped');
        }
    }

    /**
     * Send a heartbeat command to the sandbox
     */
    private async sendHeartbeat(): Promise<void> {
        try {
            const provider = sandboxManager.getActiveProvider();

            if (!provider) {
                console.log('[KeepAlive] No active provider for heartbeat');
                return;
            }

            if (!provider.isAlive()) {
                console.log('[KeepAlive] Provider not alive, skipping heartbeat');
                healthMonitor.setState('unhealthy');
                return;
            }

            // Send a lightweight command to keep the sandbox active
            // Using 'true' command which does nothing but return success
            const result = await provider.runCommand('true');

            if (this.sessionInfo) {
                this.sessionInfo.heartbeatCount++;
                this.sessionInfo.lastActivity = new Date();
            }

            if (result.success) {
                console.log(`[KeepAlive] Heartbeat #${this.sessionInfo?.heartbeatCount} successful`);
            } else {
                console.log('[KeepAlive] Heartbeat command failed:', result.stderr);
                healthMonitor.setState('unhealthy');
            }

        } catch (error) {
            console.error('[KeepAlive] Heartbeat error:', error);
            healthMonitor.setState('unhealthy');
        }
    }

    /**
     * Emit an event to all listeners
     */
    private emitEvent(type: string, session: SessionInfo): void {
        for (const listener of this.listeners) {
            try {
                listener({ type, session });
            } catch (error) {
                console.error('[KeepAlive] Error in listener:', error);
            }
        }
    }
}

// Export singleton instance
export const keepAlive = new SandboxKeepAlive();

export default keepAlive;
