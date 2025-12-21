'use client';

/**
 * useAgentWebSocket Hook
 * Connects to the agent WebSocket for real-time updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  ServerMessage, 
  ClientMessage,
  StateUpdateMessage,
  PhaseUpdateMessage,
  AgentMessage as AgentMessageType,
  parseClientMessage,
  serializeMessage,
} from '@/lib/agents/websocket/types';
import { CurrentDevState } from '@/lib/agents/state/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentState {
  devState: CurrentDevState;
  phasesCompleted: number;
  phasesTotal: number;
  currentPhase?: string;
  isGenerating: boolean;
  isDebugging: boolean;
  previewUrl?: string;
}

export interface Phase {
  name: string;
  status: 'pending' | 'started' | 'completed' | 'failed';
  progress: number;
  filesGenerated?: string[];
  error?: string;
}

export interface AgentMessage {
  agent: string;
  message: string;
  timestamp: Date;
}

export interface UseAgentWebSocketOptions {
  sessionId: string;
  userId?: string;
  projectId?: string;
  onStateUpdate?: (state: AgentState) => void;
  onPhaseUpdate?: (phase: Phase) => void;
  onAgentMessage?: (message: AgentMessage) => void;
  onError?: (error: string) => void;
  autoConnect?: boolean;
}

export interface UseAgentWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  state: AgentState | null;
  phases: Phase[];
  messages: AgentMessage[];
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  startGeneration: (query: string, templateName?: string) => void;
  stopGeneration: () => void;
  startDebug: (issue: string, focusPaths?: string[]) => void;
  cancelOperation: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AgentState = {
  devState: CurrentDevState.IDLE,
  phasesCompleted: 0,
  phasesTotal: 0,
  isGenerating: false,
  isDebugging: false,
};

// ============================================================================
// HOOK
// ============================================================================

export function useAgentWebSocket(options: UseAgentWebSocketOptions): UseAgentWebSocketReturn {
  const {
    sessionId,
    userId,
    projectId,
    onStateUpdate,
    onPhaseUpdate,
    onAgentMessage,
    onError,
    autoConnect = true,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [state, setState] = useState<AgentState | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle incoming message
   */
  const handleMessage = useCallback((data: string) => {
    try {
      const message: ServerMessage = JSON.parse(data);

      switch (message.type) {
        case 'connected':
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          break;

        case 'state_update':
          const newState = message.payload as StateUpdateMessage['payload'];
          setState(newState);
          onStateUpdate?.(newState);
          break;

        case 'phase_update':
          const phaseUpdate = message.payload as PhaseUpdateMessage['payload'];
          setPhases(prev => {
            const existing = prev.find(p => p.name === phaseUpdate.phaseName);
            if (existing) {
              return prev.map(p =>
                p.name === phaseUpdate.phaseName
                  ? { ...p, status: phaseUpdate.status, progress: phaseUpdate.progress, error: phaseUpdate.error }
                  : p
              );
            }
            return [...prev, {
              name: phaseUpdate.phaseName,
              status: phaseUpdate.status,
              progress: phaseUpdate.progress,
              filesGenerated: phaseUpdate.filesGenerated,
              error: phaseUpdate.error,
            }];
          });
          onPhaseUpdate?.({
            name: phaseUpdate.phaseName,
            status: phaseUpdate.status,
            progress: phaseUpdate.progress,
            filesGenerated: phaseUpdate.filesGenerated,
            error: phaseUpdate.error,
          });
          break;

        case 'agent_message':
          const agentMsg = message.payload as AgentMessageType['payload'];
          const newMessage: AgentMessage = {
            agent: agentMsg.agent,
            message: agentMsg.message,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, newMessage]);
          onAgentMessage?.(newMessage);
          break;

        case 'error':
          const errorPayload = message.payload as { message: string };
          setError(errorPayload.message);
          onError?.(errorPayload.message);
          break;

        case 'generation_complete':
        case 'debug_complete':
          // Update state to idle
          setState(prev => prev ? { ...prev, isGenerating: false, isDebugging: false } : null);
          break;

        case 'pong':
          // Connection is alive
          break;
      }
    } catch (err) {
      console.error('[useAgentWebSocket] Error parsing message:', err);
    }
  }, [onStateUpdate, onPhaseUpdate, onAgentMessage, onError]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    const socket = io({
      path: '/api/agent-ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // Send init message
      socket.emit('message', JSON.stringify({
        type: 'init',
        payload: { sessionId, userId, projectId },
      }));
    });

    socket.on('message', handleMessage);

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setIsConnecting(false);
      setError(`Connection error: ${err.message}`);
      onError?.(`Connection error: ${err.message}`);
    });

    socketRef.current = socket;
  }, [sessionId, userId, projectId, handleMessage, isConnecting, onError]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Send a message
   */
  const send = useCallback((message: ClientMessage) => {
    if (!socketRef.current?.connected) {
      setError('Not connected');
      return;
    }
    socketRef.current.emit('message', JSON.stringify(message));
  }, []);

  /**
   * Send user message
   */
  const sendMessage = useCallback((content: string) => {
    send({ type: 'user_message', payload: { content } });
  }, [send]);

  /**
   * Start code generation
   */
  const startGeneration = useCallback((query: string, templateName?: string) => {
    setPhases([]);
    setMessages([]);
    send({
      type: 'start_generation',
      payload: { query, templateName },
    });
  }, [send]);

  /**
   * Stop generation
   */
  const stopGeneration = useCallback(() => {
    send({ type: 'stop_generation', payload: {} });
  }, [send]);

  /**
   * Start debug session
   */
  const startDebug = useCallback((issue: string, focusPaths?: string[]) => {
    send({
      type: 'start_debug',
      payload: { issue, focusPaths },
    });
  }, [send]);

  /**
   * Cancel current operation
   */
  const cancelOperation = useCallback(() => {
    send({ type: 'cancel_operation', payload: {} });
  }, [send]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      send({ type: 'ping', payload: { timestamp: Date.now() } });
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, send]);

  return {
    isConnected,
    isConnecting,
    state,
    phases,
    messages,
    error,
    connect,
    disconnect,
    sendMessage,
    startGeneration,
    stopGeneration,
    startDebug,
    cancelOperation,
  };
}

export default useAgentWebSocket;





