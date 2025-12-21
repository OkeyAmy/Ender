/**
 * Agent State Manager
 * MongoDB-backed persistent state management for multi-agent system
 */

import { getDb } from '@/lib/mongo';
import {
  AgentState,
  AgentStateUpdate,
  AgentInitArgs,
  CurrentDevState,
  ConversationMessage,
  RuntimeError,
  PhaseState,
  FileState,
  CommandLog,
} from './types';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = 'agent_states';

/**
 * Ensures required indexes exist on the agent_states collection
 */
async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  await Promise.all([
    collection.createIndex({ sessionId: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, createdAt: -1 }),
    collection.createIndex({ projectId: 1 }),
    collection.createIndex({ currentDevState: 1 }),
    collection.createIndex({ updatedAt: -1 }),
    collection.createIndex({ 'sandboxInstanceId': 1 }),
  ]);
}

// Initialize indexes on module load
let indexesInitialized = false;

async function initializeIndexes(): Promise<void> {
  if (!indexesInitialized) {
    await ensureIndexes();
    indexesInitialized = true;
  }
}

/**
 * AgentStateManager - Handles all agent state persistence operations
 */
export class AgentStateManager {
  private sessionId: string;
  private cachedState: AgentState | null = null;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Create a new agent state with initial values
   */
  async create(args: AgentInitArgs): Promise<AgentState> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    const now = new Date();
    const initialState: AgentState = {
      // Identifiers
      sessionId: args.sessionId,
      userId: args.userId,
      projectId: args.projectId,

      // Blueprint & Planning
      projectName: '',
      originalQuery: args.query,
      templateName: args.templateName,

      // File State
      generatedFilesMap: {},
      generatedPhases: [],

      // Execution State
      currentDevState: CurrentDevState.IDLE,
      phasesCounter: 0,
      mvpGenerated: false,
      reviewingInitiated: false,
      reviewCycles: 0,

      // Agent Configuration
      agentMode: args.agentMode || 'deterministic',
      shouldBeGenerating: false,
      isDebugging: false,

      // Sandbox State
      sandboxProvider: args.sandboxProvider,

      // Command History
      commandsHistory: [],
      commandLogs: [],

      // Conversation
      conversationMessages: [],
      pendingUserInputs: [],
      projectUpdatesAccumulator: [],

      // Debugging
      runtimeErrors: [],
      clientReportedErrors: [],

      // Timestamps
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    await collection.insertOne(initialState);
    this.sessionId = args.sessionId;
    this.cachedState = initialState;

    return initialState;
  }

  /**
   * Get the current state from database
   */
  async getState(): Promise<AgentState | null> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    const state = await collection.findOne({ sessionId: this.sessionId });
    if (state) {
      this.cachedState = state;
    }
    return state;
  }

  /**
   * Get state with caching (use for frequent reads)
   */
  async getCachedState(): Promise<AgentState | null> {
    if (this.cachedState) {
      return this.cachedState;
    }
    return this.getState();
  }

  /**
   * Update state with partial updates
   */
  async updateState(update: AgentStateUpdate): Promise<AgentState | null> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    // Build MongoDB update object
    const mongoUpdate: Record<string, unknown> = {};

    if (update.$set) {
      mongoUpdate.$set = {
        ...update.$set,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      };
    } else {
      mongoUpdate.$set = {
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      };
    }

    if (update.$push) {
      mongoUpdate.$push = update.$push;
    }

    if (update.$inc) {
      mongoUpdate.$inc = update.$inc;
    }

    const result = await collection.findOneAndUpdate(
      { sessionId: this.sessionId },
      mongoUpdate,
      { returnDocument: 'after' }
    );

    if (result) {
      this.cachedState = result;
    }

    return result;
  }

  /**
   * Set a specific field value
   */
  async setField<K extends keyof AgentState>(
    field: K,
    value: AgentState[K]
  ): Promise<AgentState | null> {
    return this.updateState({
      $set: { [field]: value } as Partial<AgentState>,
    });
  }

  /**
   * Add a conversation message
   */
  async addMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: ConversationMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };

    await this.updateState({
      $push: { conversationMessages: fullMessage },
    });
  }

  /**
   * Add a runtime error
   */
  async addRuntimeError(error: Omit<RuntimeError, 'timestamp'>): Promise<void> {
    const fullError: RuntimeError = {
      ...error,
      timestamp: new Date(),
    };

    await this.updateState({
      $push: { runtimeErrors: fullError },
    });
  }

  /**
   * Add a command to history
   */
  async addCommand(command: string): Promise<void> {
    await this.updateState({
      $push: { commandsHistory: command },
    });
  }

  /**
   * Add a command log entry (stdout/stderr) with rolling retention
   */
  async addCommandLog(log: Omit<CommandLog, 'timestamp'> & { timestamp?: Date }): Promise<void> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    const entry: CommandLog = {
      ...log,
      timestamp: log.timestamp || new Date(),
    };

    await collection.updateOne(
      { sessionId: this.sessionId },
      {
        $set: {
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        },
        $push: {
          commandLogs: {
            $each: [entry],
            $slice: -200,
          },
        },
      }
    );
  }

  /**
   * Update generated file
   */
  async updateGeneratedFile(file: FileState): Promise<void> {
    const state = await this.getCachedState();
    if (!state) return;

    const updatedFiles = {
      ...state.generatedFilesMap,
      [file.filePath]: file,
    };

    await this.updateState({
      $set: { generatedFilesMap: updatedFiles },
    });
  }

  /**
   * Add a completed phase
   */
  async addPhase(phase: PhaseState): Promise<void> {
    await this.updateState({
      $push: { generatedPhases: phase },
      $inc: { phasesCounter: 1 },
    });
  }

  /**
   * Update current dev state
   */
  async setDevState(state: CurrentDevState): Promise<void> {
    await this.setField('currentDevState', state);
  }

  /**
   * Set debugging mode
   */
  async setDebugging(isDebugging: boolean): Promise<void> {
    await this.setField('isDebugging', isDebugging);
  }

  /**
   * Set the blueprint
   */
  async setBlueprint(blueprint: AgentState['blueprint']): Promise<void> {
    await this.updateState({
      $set: {
        blueprint,
        projectName: blueprint?.projectName || '',
      },
    });
  }

  /**
   * Set sandbox instance
   */
  async setSandbox(sandboxInstanceId: string, hostname?: string, previewUrl?: string): Promise<void> {
    await this.updateState({
      $set: {
        sandboxInstanceId,
        hostname,
        previewUrl,
      },
    });
  }

  /**
   * Clear runtime errors
   */
  async clearRuntimeErrors(): Promise<void> {
    await this.setField('runtimeErrors', []);
  }

  /**
   * Check if session exists
   */
  async exists(): Promise<boolean> {
    const state = await this.getState();
    return state !== null;
  }

  /**
   * Delete the agent state
   */
  async delete(): Promise<boolean> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    const result = await collection.deleteOne({ sessionId: this.sessionId });
    this.cachedState = null;

    return result.deletedCount > 0;
  }

  /**
   * Get recent states for a user
   */
  static async getRecentByUser(userId: string, limit = 10): Promise<AgentState[]> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    return collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get state by project ID
   */
  static async getByProjectId(projectId: string): Promise<AgentState | null> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    return collection.findOne({ projectId });
  }

  /**
   * Get active sessions (currently generating)
   */
  static async getActiveSessions(): Promise<AgentState[]> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    return collection
      .find({
        shouldBeGenerating: true,
        currentDevState: { $ne: CurrentDevState.IDLE },
      })
      .toArray();
  }

  /**
   * Clean up old sessions (older than specified days)
   */
  static async cleanup(daysOld = 7): Promise<number> {
    await initializeIndexes();
    const db = await getDb();
    const collection = db.collection<AgentState>(COLLECTION_NAME);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await collection.deleteMany({
      updatedAt: { $lt: cutoffDate },
      shouldBeGenerating: false,
    });

    return result.deletedCount;
  }
}

export default AgentStateManager;



