/**
 * WebSocket Types
 * Type definitions for real-time agent communication
 */

import { CurrentDevState } from '../state/types';

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type WebSocketMessageType =
  // Client -> Server
  | 'init'
  | 'user_message'
  | 'start_generation'
  | 'stop_generation'
  | 'start_debug'
  | 'cancel_operation'
  | 'ping'
  // Server -> Client
  | 'connected'
  | 'state_update'
  | 'phase_update'
  | 'file_update'
  | 'agent_message'
  | 'stream_chunk'
  | 'error'
  | 'generation_complete'
  | 'debug_complete'
  | 'pong';

// ============================================================================
// CLIENT MESSAGES
// ============================================================================

export interface InitMessage {
  type: 'init';
  payload: {
    sessionId: string;
    userId?: string;
    projectId?: string;
  };
}

export interface UserMessage {
  type: 'user_message';
  payload: {
    content: string;
    attachments?: string[];
  };
}

export interface StartGenerationMessage {
  type: 'start_generation';
  payload: {
    query: string;
    templateName?: string;
    agentMode?: 'deterministic' | 'smart';
  };
}

export interface StopGenerationMessage {
  type: 'stop_generation';
  payload: Record<string, never>;
}

export interface StartDebugMessage {
  type: 'start_debug';
  payload: {
    issue: string;
    focusPaths?: string[];
  };
}

export interface CancelOperationMessage {
  type: 'cancel_operation';
  payload: Record<string, never>;
}

export interface PingMessage {
  type: 'ping';
  payload: { timestamp: number };
}

export type ClientMessage =
  | InitMessage
  | UserMessage
  | StartGenerationMessage
  | StopGenerationMessage
  | StartDebugMessage
  | CancelOperationMessage
  | PingMessage;

// ============================================================================
// SERVER MESSAGES
// ============================================================================

export interface ConnectedMessage {
  type: 'connected';
  payload: {
    sessionId: string;
    serverTime: number;
  };
}

export interface StateUpdateMessage {
  type: 'state_update';
  payload: {
    devState: CurrentDevState;
    phasesCompleted: number;
    phasesTotal: number;
    currentPhase?: string;
    isGenerating: boolean;
    isDebugging: boolean;
    previewUrl?: string;
  };
}

export interface PhaseUpdateMessage {
  type: 'phase_update';
  payload: {
    phaseName: string;
    status: 'started' | 'completed' | 'failed';
    filesGenerated?: string[];
    error?: string;
    progress: number;
  };
}

export interface FileUpdateMessage {
  type: 'file_update';
  payload: {
    filePath: string;
    action: 'created' | 'updated' | 'deleted';
    diff?: string;
  };
}

export interface AgentMessagePayload {
  agent: 'orchestrator' | 'codegen' | 'debug' | 'review' | 'build';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMessage {
  type: 'agent_message';
  payload: AgentMessagePayload;
}

export interface StreamChunkMessage {
  type: 'stream_chunk';
  payload: {
    content: string;
    isComplete: boolean;
    source: 'codegen' | 'debug' | 'review';
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface GenerationCompleteMessage {
  type: 'generation_complete';
  payload: {
    success: boolean;
    projectName: string;
    filesGenerated: number;
    previewUrl?: string;
    summary: string;
  };
}

export interface DebugCompleteMessage {
  type: 'debug_complete';
  payload: {
    success: boolean;
    issuesFixed: number;
    issuesRemaining: number;
    transcript: string;
  };
}

export interface PongMessage {
  type: 'pong';
  payload: { timestamp: number };
}

export type ServerMessage =
  | ConnectedMessage
  | StateUpdateMessage
  | PhaseUpdateMessage
  | FileUpdateMessage
  | AgentMessage
  | StreamChunkMessage
  | ErrorMessage
  | GenerationCompleteMessage
  | DebugCompleteMessage
  | PongMessage;

// ============================================================================
// CONNECTION STATE
// ============================================================================

export interface WebSocketConnection {
  sessionId: string;
  userId?: string;
  projectId?: string;
  connectedAt: Date;
  lastActivity: Date;
  isAlive: boolean;
}

export interface WebSocketState {
  connections: Map<string, WebSocketConnection>;
  sessionSockets: Map<string, WebSocket[]>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a typed message
 */
export function createMessage<T extends ServerMessage>(
  type: T['type'],
  payload: T['payload']
): T {
  return { type, payload } as T;
}

/**
 * Parse incoming message
 */
export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type && parsed.payload !== undefined) {
      return parsed as ClientMessage;
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

/**
 * Serialize message for sending
 */
export function serializeMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}




