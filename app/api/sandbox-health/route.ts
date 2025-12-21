import { NextResponse } from 'next/server';
import { healthMonitor } from '@/lib/sandbox/health/health-monitor';
import { sandboxOrchestrator } from '@/lib/sandbox/orchestrator/sandbox-orchestrator';

/**
 * GET /api/sandbox-health
 * Returns detailed health status of the sandbox
 */
export async function GET() {
    try {
        const status = sandboxOrchestrator.getStatus();
        const healthResult = healthMonitor.getLastResult();

        return NextResponse.json({
            success: true,
            healthy: healthResult?.healthy ?? false,
            status: healthResult?.status ?? 'unknown',
            state: status.state,
            details: {
                sandboxId: status.sandboxId,
                responseTimeMs: healthResult?.responseTimeMs,
                lastCheck: healthResult?.lastCheck?.toISOString(),
                sandboxAlive: healthResult?.details?.sandboxAlive,
                commandResponsive: healthResult?.details?.commandResponsive,
                viteRunning: healthResult?.details?.viteRunning,
                sessionActive: !!status.session,
                recovering: status.recovering,
                pendingErrors: status.errors.length,
            },
        });

    } catch (error) {
        console.error('[sandbox-health] Error:', error);
        return NextResponse.json({
            success: false,
            healthy: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}

/**
 * POST /api/sandbox-health
 * Trigger a manual health check
 */
export async function POST() {
    try {
        console.log('[sandbox-health] Triggering manual health check...');

        const result = await healthMonitor.forceCheck();

        return NextResponse.json({
            success: true,
            result: {
                healthy: result.healthy,
                status: result.status,
                responseTimeMs: result.responseTimeMs,
                lastCheck: result.lastCheck.toISOString(),
                error: result.error,
                details: result.details,
            },
        });

    } catch (error) {
        console.error('[sandbox-health] Check failed:', error);
        return NextResponse.json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}
