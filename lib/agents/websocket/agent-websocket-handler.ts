/**
 * Agent WebSocket Handler
 * Handles real-time communication between clients and agents
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { AgentStateManager } from '../state/agent-state-manager';
import { PhaseManager } from '../state/phase-manager';
import { FileManager } from '../state/file-manager';
import { createAllAgents, AgentFactoryConfig } from '../agents';
import { createAllTools } from '../tools';
import { ModelFactory } from '../models/model-factory';
import { appConfig } from '@/config/app.config';
import { enhancedSelfHealing } from '@/lib/sandbox/automation/enhanced-self-healing';
import {
  ClientMessage,
  ServerMessage,
  StateUpdateMessage,
  PhaseUpdateMessage,
  AgentMessage,
  ErrorMessage,
  createMessage,
  parseClientMessage,
  serializeMessage,
} from './types';
import { CurrentDevState } from '../state/types';

// ============================================================================
// TYPES
// ============================================================================

interface SessionContext {
  sessionId: string;
  userId?: string;
  projectId?: string;
  stateManager: AgentStateManager;
  phaseManager: PhaseManager;
  fileManager: FileManager;
  agents: ReturnType<typeof createAllAgents>;
  isGenerating: boolean;
  isDebugging: boolean;
  abortController?: AbortController;
}

// ============================================================================
// WEBSOCKET HANDLER CLASS
// ============================================================================

export class AgentWebSocketHandler {
  private sessions: Map<string, SessionContext> = new Map();
  private socketToSession: Map<string, string> = new Map();
  private io: SocketIOServer | null = null;

  /**
   * Initialize with Socket.IO server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      socket.on('message', (data: string) => this.handleMessage(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('error', (error) => this.handleError(socket, error));
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(socket: Socket, data: string): Promise<void> {
    const message = parseClientMessage(data);
    if (!message) {
      this.sendError(socket, 'INVALID_MESSAGE', 'Invalid message format');
      return;
    }

    try {
      switch (message.type) {
        case 'init':
          await this.handleInit(socket, message);
          break;
        case 'user_message':
          await this.handleUserMessage(socket, message);
          break;
        case 'start_generation':
          await this.handleStartGeneration(socket, message);
          break;
        case 'stop_generation':
          await this.handleStopGeneration(socket);
          break;
        case 'start_debug':
          await this.handleStartDebug(socket, message);
          break;
        case 'cancel_operation':
          await this.handleCancelOperation(socket);
          break;
        case 'ping':
          this.sendMessage(socket, { type: 'pong', payload: { timestamp: Date.now() } });
          break;
        default:
          this.sendError(socket, 'UNKNOWN_MESSAGE', `Unknown message type`);
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
      this.sendError(socket, 'HANDLER_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle init message - create or join session
   */
  private async handleInit(socket: Socket, message: ClientMessage): Promise<void> {
    if (message.type !== 'init') return;

    const { sessionId, userId, projectId } = message.payload;

    // Check if session exists
    let context = this.sessions.get(sessionId);

    if (!context) {
      // Create new session
      const stateManager = new AgentStateManager(sessionId);
      
      // Check if state exists in DB
      const existingState = await stateManager.getState();
      if (!existingState) {
        await stateManager.create({
          sessionId,
          userId,
          projectId,
          query: '',
        });
      }

      // Create model and tools
      const modelConfig = ModelFactory.fromModelId(appConfig.ai.defaultModel, {
        apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
      });
      const model = ModelFactory.create(modelConfig);
      const tools = createAllTools(stateManager);

      // Create agents
      const agents = createAllAgents({
        stateManager,
        model,
        tools,
      });

      context = {
        sessionId,
        userId,
        projectId,
        stateManager,
        phaseManager: new PhaseManager(stateManager),
        fileManager: new FileManager(stateManager),
        agents,
        isGenerating: false,
        isDebugging: false,
      };

      this.sessions.set(sessionId, context);
    }

    // Associate socket with session
    socket.join(sessionId);
    this.socketToSession.set(socket.id, sessionId);

    // Send connected message
    this.sendMessage(socket, {
      type: 'connected',
      payload: { sessionId, serverTime: Date.now() },
    });

    // Send current state
    await this.sendStateUpdate(socket, context);
  }

  /**
   * Handle user message
   */
  private async handleUserMessage(socket: Socket, message: ClientMessage): Promise<void> {
    if (message.type !== 'user_message') return;

    const context = this.getSessionContext(socket);
    if (!context) {
      this.sendError(socket, 'NO_SESSION', 'No active session');
      return;
    }

    // Add message to state
    await context.stateManager.addMessage({
      role: 'user',
      content: message.payload.content,
    });

    // Add to pending inputs
    await context.stateManager.updateState({
      $push: { pendingUserInputs: message.payload.content },
    });
  }

  /**
   * Handle start generation
   */
  private async handleStartGeneration(socket: Socket, message: ClientMessage): Promise<void> {
    if (message.type !== 'start_generation') return;

    const context = this.getSessionContext(socket);
    if (!context) {
      this.sendError(socket, 'NO_SESSION', 'No active session');
      return;
    }

    if (context.isGenerating) {
      this.sendError(socket, 'ALREADY_GENERATING', 'Generation already in progress');
      return;
    }

    const { query, templateName, agentMode } = message.payload;

    // Update state
    await context.stateManager.updateState({
      $set: {
        originalQuery: query,
        templateName,
        agentMode: agentMode || 'deterministic',
        shouldBeGenerating: true,
        currentDevState: CurrentDevState.PHASE_GENERATING,
      },
    });

    context.isGenerating = true;
    context.abortController = new AbortController();
    enhancedSelfHealing.start({
      sessionId: context.sessionId,
      aiModelId: appConfig.ai.defaultModel,
    });

    // Start generation in background
    this.runGeneration(context, socket).catch(error => {
      console.error('[WebSocket] Generation error:', error);
      this.sendError(socket, 'GENERATION_ERROR', error.message);
    });
  }

  /**
   * Run the generation process
   */
  private async runGeneration(context: SessionContext, socket: Socket): Promise<void> {
    const { stateManager, phaseManager, agents } = context;
    
    try {
      const state = await stateManager.getState();
      if (!state) throw new Error('No state found');

      // Send agent message
      this.sendAgentMessage(socket, 'orchestrator', 'Starting code generation...');

      // Generate blueprint
      const blueprint = await agents.codegen.generateBlueprint(
        state.originalQuery,
        state.templateName
      );

      if (!blueprint) {
        throw new Error('Failed to generate blueprint');
      }

      await stateManager.setBlueprint(blueprint);
      this.sendAgentMessage(socket, 'codegen', `Blueprint created: ${blueprint.title}`);

      // Generate phases
      let phaseIndex = 0;
      while (context.isGenerating) {
        const nextPhase = await agents.codegen.generateNextPhase();
        if (!nextPhase) break;

        phaseIndex++;
        
        // Send phase update
        this.sendPhaseUpdate(socket, nextPhase.name, 'started', phaseIndex);

        try {
          // Implement phase
          const result = await agents.codegen.implementPhase(nextPhase, blueprint);

          // Update files
          for (const file of result.files) {
            this.sendMessage(socket, {
              type: 'file_update',
              payload: {
                filePath: file.filePath,
                action: 'created',
              },
            });
          }

          // Complete phase
          await phaseManager.completePhase(result.files.map(f => f.filePath));
          this.sendPhaseUpdate(socket, nextPhase.name, 'completed', phaseIndex);

        } catch (error) {
          this.sendPhaseUpdate(socket, nextPhase.name, 'failed', phaseIndex, 
            error instanceof Error ? error.message : 'Phase failed');
        }

        // Send state update
        await this.sendStateUpdate(socket, context);
      }

      // Generation complete
      context.isGenerating = false;
      await stateManager.updateState({
        $set: {
          shouldBeGenerating: false,
          currentDevState: CurrentDevState.IDLE,
          mvpGenerated: true,
        },
      });

      const finalState = await stateManager.getState();
      
      this.sendMessage(socket, {
        type: 'generation_complete',
        payload: {
          success: true,
          projectName: finalState?.projectName || 'Unknown',
          filesGenerated: Object.keys(finalState?.generatedFilesMap || {}).length,
          previewUrl: finalState?.previewUrl,
          summary: `Generated ${finalState?.phasesCounter || 0} phases successfully`,
        },
      });

    } catch (error) {
      context.isGenerating = false;
      await stateManager.updateState({
        $set: {
          shouldBeGenerating: false,
          currentDevState: CurrentDevState.IDLE,
        },
      });
      throw error;
    } finally {
      enhancedSelfHealing.stop();
    }
  }

  /**
   * Handle stop generation
   */
  private async handleStopGeneration(socket: Socket): Promise<void> {
    const context = this.getSessionContext(socket);
    if (!context) return;

    context.isGenerating = false;
    context.abortController?.abort();
    enhancedSelfHealing.stop();

    await context.stateManager.updateState({
      $set: {
        shouldBeGenerating: false,
        currentDevState: CurrentDevState.IDLE,
      },
    });

    this.sendAgentMessage(socket, 'orchestrator', 'Generation stopped');
    await this.sendStateUpdate(socket, context);
  }

  /**
   * Handle start debug
   */
  private async handleStartDebug(socket: Socket, message: ClientMessage): Promise<void> {
    if (message.type !== 'start_debug') return;

    const context = this.getSessionContext(socket);
    if (!context) {
      this.sendError(socket, 'NO_SESSION', 'No active session');
      return;
    }

    if (context.isDebugging) {
      this.sendError(socket, 'ALREADY_DEBUGGING', 'Debug session already in progress');
      return;
    }

    const { issue, focusPaths } = message.payload;

    context.isDebugging = true;
    await context.stateManager.setDebugging(true);
    await context.stateManager.setDevState(CurrentDevState.DEBUGGING);

    this.sendAgentMessage(socket, 'debug', `Starting debug session: ${issue}`);

    try {
      const state = await context.stateManager.getState();
      const filesIndex = Object.values(state?.generatedFilesMap || {});

      const result = await context.agents.debug.execute({
        input: issue,
        context: {
          issue,
          runtimeErrors: state?.runtimeErrors || [],
          filesIndex,
          focusPaths,
          previousTranscript: state?.lastDeepDebugTranscript,
        },
      });

      const debugResult = JSON.parse(result.output);

      await context.stateManager.updateState({
        $set: {
          lastDeepDebugTranscript: debugResult.transcript,
          isDebugging: false,
          currentDevState: CurrentDevState.IDLE,
        },
      });

      this.sendMessage(socket, {
        type: 'debug_complete',
        payload: {
          success: debugResult.status === 'TASK_COMPLETE',
          issuesFixed: debugResult.fixesApplied?.length || 0,
          issuesRemaining: debugResult.issuesFound?.length || 0,
          transcript: debugResult.transcript,
        },
      });

    } catch (error) {
      context.isDebugging = false;
      await context.stateManager.setDebugging(false);
      throw error;
    }
  }

  /**
   * Handle cancel operation
   */
  private async handleCancelOperation(socket: Socket): Promise<void> {
    const context = this.getSessionContext(socket);
    if (!context) return;

    context.isGenerating = false;
    context.isDebugging = false;
    context.abortController?.abort();
    enhancedSelfHealing.stop();

    await context.stateManager.updateState({
      $set: {
        shouldBeGenerating: false,
        isDebugging: false,
        currentDevState: CurrentDevState.IDLE,
      },
    });

    this.sendAgentMessage(socket, 'orchestrator', 'Operation cancelled');
    await this.sendStateUpdate(socket, context);
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const sessionId = this.socketToSession.get(socket.id);
    if (sessionId) {
      this.socketToSession.delete(socket.id);
      // Don't delete session - others might be connected
    }
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  }

  /**
   * Handle error
   */
  private handleError(socket: Socket, error: Error): void {
    console.error(`[WebSocket] Socket error: ${socket.id}`, error);
    this.sendError(socket, 'SOCKET_ERROR', error.message);
  }

  /**
   * Get session context for socket
   */
  private getSessionContext(socket: Socket): SessionContext | undefined {
    const sessionId = this.socketToSession.get(socket.id);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  /**
   * Send message to socket
   */
  private sendMessage(socket: Socket, message: ServerMessage): void {
    socket.emit('message', serializeMessage(message));
  }

  /**
   * Send error message
   */
  private sendError(socket: Socket, code: string, message: string): void {
    this.sendMessage(socket, {
      type: 'error',
      payload: { code, message, recoverable: true },
    });
  }

  /**
   * Send agent message
   */
  private sendAgentMessage(
    socket: Socket,
    agent: 'orchestrator' | 'codegen' | 'debug' | 'review' | 'build',
    message: string
  ): void {
    this.sendMessage(socket, {
      type: 'agent_message',
      payload: { agent, message },
    });
  }

  /**
   * Send phase update
   */
  private sendPhaseUpdate(
    socket: Socket,
    phaseName: string,
    status: 'started' | 'completed' | 'failed',
    progress: number,
    error?: string
  ): void {
    this.sendMessage(socket, {
      type: 'phase_update',
      payload: { phaseName, status, progress, error },
    });
  }

  /**
   * Send state update
   */
  private async sendStateUpdate(socket: Socket, context: SessionContext): Promise<void> {
    const state = await context.stateManager.getState();
    if (!state) return;

    const stats = await context.phaseManager.getPhaseStats();

    this.sendMessage(socket, {
      type: 'state_update',
      payload: {
        devState: state.currentDevState,
        phasesCompleted: stats.completed,
        phasesTotal: stats.total,
        currentPhase: stats.currentPhase || undefined,
        isGenerating: state.shouldBeGenerating,
        isDebugging: state.isDebugging,
        previewUrl: state.previewUrl,
      },
    });
  }

  /**
   * Broadcast to session
   */
  broadcastToSession(sessionId: string, message: ServerMessage): void {
    if (this.io) {
      this.io.to(sessionId).emit('message', serializeMessage(message));
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup inactive sessions
   */
  cleanupInactiveSessions(maxAgeMs = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [sessionId, context] of this.sessions) {
      // Check if any sockets are still connected
      const room = this.io?.sockets.adapter.rooms.get(sessionId);
      if (!room || room.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

export const agentWebSocketHandler = new AgentWebSocketHandler();
export default agentWebSocketHandler;



