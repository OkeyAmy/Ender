import { NextResponse } from 'next/server';
import { keepAlive } from '@/lib/sandbox/lifecycle/keep-alive';
import { healthMonitor } from '@/lib/sandbox/health/health-monitor';
import { sandboxOrchestrator } from '@/lib/sandbox/orchestrator/sandbox-orchestrator';

declare global {
    var generationMonitor: {
        isGenerating: boolean;
        currentOperation: string;
        lastError: string | null;
        startTime: number | null;
        filesProcessed: number;
        totalFiles: number;
    } | null;
}

/**
 * GET /api/generation-status
 * Returns current AI generation status for frontend monitoring
 * This enables the internal "AI agent" to track generation state
 */
export async function GET() {
    try {
        const sessionInfo = keepAlive.getSessionInfo();
        const healthResult = healthMonitor.getLastResult();
        const orchestratorStatus = sandboxOrchestrator.getStatus();
        const genMonitor = global.generationMonitor;

        // Calculate elapsed time if generation is active
        const elapsedMs = genMonitor?.startTime
            ? Date.now() - genMonitor.startTime
            : null;

        return NextResponse.json({
            success: true,
            generation: {
                isActive: genMonitor?.isGenerating ?? false,
                currentOperation: genMonitor?.currentOperation ?? 'idle',
                lastError: genMonitor?.lastError ?? null,
                filesProcessed: genMonitor?.filesProcessed ?? 0,
                totalFiles: genMonitor?.totalFiles ?? 0,
                elapsedMs,
                progress: genMonitor?.totalFiles
                    ? Math.round((genMonitor.filesProcessed / genMonitor.totalFiles) * 100)
                    : 0,
            },
            session: sessionInfo ? {
                active: true,
                type: sessionInfo.type,
                heartbeatCount: sessionInfo.heartbeatCount,
                durationMs: Date.now() - sessionInfo.startedAt.getTime(),
            } : { active: false },
            health: {
                status: healthResult?.status ?? 'unknown',
                healthy: healthResult?.healthy ?? false,
                lastCheck: healthResult?.lastCheck?.toISOString() ?? null,
                responseTimeMs: healthResult?.responseTimeMs ?? null,
            },
            sandbox: {
                state: orchestratorStatus.state,
                recovering: orchestratorStatus.recovering,
                pendingErrors: orchestratorStatus.errors.length,
                errors: orchestratorStatus.errors.map(e => e.message),
            },
            // Recommendations for next action
            recommendations: getRecommendations(genMonitor, healthResult, orchestratorStatus),
        });

    } catch (error) {
        console.error('[generation-status] Error:', error);
        return NextResponse.json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}

/**
 * Generate recommendations based on current state
 */
function getRecommendations(
    genMonitor: typeof global.generationMonitor,
    healthResult: ReturnType<typeof healthMonitor.getLastResult>,
    orchestratorStatus: ReturnType<typeof sandboxOrchestrator.getStatus>
): string[] {
    const recommendations: string[] = [];

    // Check for errors that need attention
    if (genMonitor?.lastError) {
        if (genMonitor.lastError.includes('410') || genMonitor.lastError.includes('stopped')) {
            recommendations.push('SANDBOX_TIMEOUT: Consider triggering re-apply');
        } else {
            recommendations.push(`ERROR: ${genMonitor.lastError}`);
        }
    }

    // Check sandbox health
    if (healthResult && !healthResult.healthy) {
        recommendations.push('SANDBOX_UNHEALTHY: Health check failed, recovery recommended');
    }

    // Check if recovery is in progress
    if (orchestratorStatus.recovering) {
        recommendations.push('RECOVERING: Automatic recovery in progress');
    }

    // Check for pending errors
    if (orchestratorStatus.errors.length > 0) {
        recommendations.push(`PENDING_ERRORS: ${orchestratorStatus.errors.length} errors need attention`);
    }

    // Status OK
    if (recommendations.length === 0) {
        if (genMonitor?.isGenerating) {
            recommendations.push('IN_PROGRESS: Generation is proceeding normally');
        } else {
            recommendations.push('READY: System ready for next operation');
        }
    }

    return recommendations;
}
