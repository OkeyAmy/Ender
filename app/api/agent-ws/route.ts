/**
 * Agent WebSocket API Route
 * Handles WebSocket upgrades for real-time agent communication
 */

import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { agentWebSocketHandler } from '@/lib/agents/websocket';

// Socket.IO server instance (singleton)
let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
function getSocketIO(): SocketIOServer {
  if (!io) {
    // In Next.js, we need to attach to the server
    // This is a simplified version - production would use custom server
    io = new SocketIOServer({
      path: '/api/agent-ws',
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || '*',
        methods: ['GET', 'POST'],
      },
    });

    agentWebSocketHandler.initialize(io);
    console.log('[WebSocket] Socket.IO initialized');
  }
  return io;
}

/**
 * GET handler - returns WebSocket status
 */
export async function GET(request: NextRequest) {
  const io = getSocketIO();
  
  return NextResponse.json({
    status: 'ok',
    activeSessions: agentWebSocketHandler.getActiveSessionCount(),
    wsPath: '/api/agent-ws',
    message: 'WebSocket endpoint active. Connect using Socket.IO client.',
  });
}

/**
 * POST handler - manual message handling (fallback)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing sessionId or message' },
        { status: 400 }
      );
    }

    // Broadcast message to session
    agentWebSocketHandler.broadcastToSession(sessionId, {
      type: 'agent_message',
      payload: {
        agent: 'orchestrator',
        message: 'Message received via HTTP fallback',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}





