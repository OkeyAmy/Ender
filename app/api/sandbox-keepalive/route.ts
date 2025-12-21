import { NextResponse } from 'next/server';
import { keepAlive } from '@/lib/sandbox/lifecycle/keep-alive';
import { sandboxOrchestrator } from '@/lib/sandbox/orchestrator/sandbox-orchestrator';

/**
 * GET /api/sandbox-keepalive
 * Get current session status
 */
export async function GET() {
    try {
        const session = keepAlive.getSessionInfo();
        const status = sandboxOrchestrator.getStatus();

        return NextResponse.json({
            success: true,
            active: keepAlive.isActive(),
            session: session ? {
                sessionId: session.sessionId,
                startedAt: session.startedAt.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
                type: session.type,
                heartbeatCount: session.heartbeatCount,
                durationMs: Date.now() - session.startedAt.getTime(),
            } : null,
            sandboxState: status.state,
        });

    } catch (error) {
        console.error('[sandbox-keepalive] Error:', error);
        return NextResponse.json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}

/**
 * POST /api/sandbox-keepalive
 * Extend sandbox lifetime / record activity
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { action = 'heartbeat', type } = body;

        console.log('[sandbox-keepalive] Action:', action);

        switch (action) {
            case 'start':
                // Start a new keep-alive session
                const sessionId = keepAlive.startSession(type || 'user-prompt');
                return NextResponse.json({
                    success: true,
                    action: 'started',
                    sessionId,
                });

            case 'end':
                // End the current session
                keepAlive.endSession();
                return NextResponse.json({
                    success: true,
                    action: 'ended',
                });

            case 'heartbeat':
            default:
                // Record activity to extend session
                keepAlive.recordActivity();

                // If no session is active but we got a heartbeat, start one
                if (!keepAlive.isActive()) {
                    const newSessionId = keepAlive.startSession('user-prompt');
                    return NextResponse.json({
                        success: true,
                        action: 'session-created',
                        sessionId: newSessionId,
                        message: 'No active session, created new one',
                    });
                }

                return NextResponse.json({
                    success: true,
                    action: 'heartbeat-recorded',
                    session: keepAlive.getSessionInfo(),
                });
        }

    } catch (error) {
        console.error('[sandbox-keepalive] Error:', error);
        return NextResponse.json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}
