import { NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { healthMonitor } from '@/lib/sandbox/health/health-monitor';
import { keepAlive } from '@/lib/sandbox/lifecycle/keep-alive';
import { sandboxOrchestrator } from '@/lib/sandbox/orchestrator/sandbox-orchestrator';

declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function GET() {
  try {
    // Check sandbox manager first, then fall back to global state
    const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    const sandboxExists = !!provider;

    let sandboxHealthy = false;
    let sandboxInfo = null;

    // Get health monitor data
    const healthResult = healthMonitor.getLastResult();
    const sessionInfo = keepAlive.getSessionInfo();
    const orchestratorStatus = sandboxOrchestrator.getStatus();

    if (sandboxExists && provider) {
      try {
        // Check if sandbox is healthy by getting its info
        const providerInfo = provider.getSandboxInfo();
        sandboxHealthy = healthResult?.healthy ?? !!providerInfo;

        sandboxInfo = {
          sandboxId: providerInfo?.sandboxId || global.sandboxData?.sandboxId,
          url: providerInfo?.url || global.sandboxData?.url,
          filesTracked: global.existingFiles ? Array.from(global.existingFiles) : [],
          lastHealthCheck: healthResult?.lastCheck?.toISOString() || new Date().toISOString(),
          // Additional health data
          health: healthResult ? {
            status: healthResult.status,
            responseTimeMs: healthResult.responseTimeMs,
            sandboxAlive: healthResult.details?.sandboxAlive,
            commandResponsive: healthResult.details?.commandResponsive,
            viteRunning: healthResult.details?.viteRunning,
          } : null,
          // Session data
          session: sessionInfo ? {
            active: true,
            type: sessionInfo.type,
            heartbeatCount: sessionInfo.heartbeatCount,
            durationMs: Date.now() - sessionInfo.startedAt.getTime(),
          } : { active: false },
          // State data
          state: orchestratorStatus.state,
          recovering: orchestratorStatus.recovering,
          pendingErrors: orchestratorStatus.errors.length,
        };
      } catch (error) {
        console.error('[sandbox-status] Health check failed:', error);
        sandboxHealthy = false;
      }
    }

    return NextResponse.json({
      success: true,
      active: sandboxExists,
      healthy: sandboxHealthy,
      sandboxData: sandboxInfo,
      message: sandboxHealthy
        ? 'Sandbox is active and healthy'
        : sandboxExists
          ? 'Sandbox exists but is not responding'
          : 'No active sandbox'
    });

  } catch (error) {
    console.error('[sandbox-status] Error:', error);
    return NextResponse.json({
      success: false,
      active: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}