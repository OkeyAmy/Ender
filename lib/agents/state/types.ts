/**
 * Agent State Types
 * MongoDB-backed state management for multi-agent code generation system
 */

import { z } from 'zod';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

export const FileConceptSchema = z.object({
  path: z.string().describe('Path to the file relative to project root'),
  purpose: z.string().describe('Purpose and expected contents of the file'),
  changes: z.string().nullable().describe('Specific changes to be made if not a new file'),
});

export const PhaseConceptSchema = z.object({
  name: z.string().describe('Name of the phase'),
  description: z.string().describe('Description of the phase'),
  files: z.array(FileConceptSchema).describe('Files in this phase'),
  lastPhase: z.boolean().describe('Whether this is the last phase'),
});

export const BlueprintSchema = z.object({
  title: z.string().describe('Title of the application'),
  projectName: z.string().describe('Name of the project'),
  detailedDescription: z.string().describe('Detailed description of the application'),
  description: z.string().describe('Short description'),
  colorPalette: z.array(z.string()).describe('Color palette RGB codes'),
  views: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).describe('Views of the application'),
  userFlow: z.object({
    uiLayout: z.string().describe('UI layout description'),
    uiDesign: z.string().describe('UI design description'),
    userJourney: z.string().describe('User journey description'),
  }),
  dataFlow: z.string().describe('Data flow description'),
  architecture: z.object({
    dataFlow: z.string().describe('Architecture data flow'),
  }),
  pitfalls: z.array(z.string()).describe('Potential pitfalls to avoid'),
  frameworks: z.array(z.string()).describe('Frameworks and libraries'),
  implementationRoadmap: z.array(z.object({
    phase: z.string(),
    description: z.string(),
  })),
  initialPhase: PhaseConceptSchema.describe('The first phase'),
});

export const FileOutputSchema = z.object({
  filePath: z.string().describe('Path to the file'),
  fileContents: z.string().describe('Contents of the file'),
  filePurpose: z.string().describe('Purpose of the file'),
});

export const CodeReviewSchema = z.object({
  dependenciesNotMet: z.array(z.string()),
  issuesFound: z.boolean(),
  frontendIssues: z.array(z.string()),
  backendIssues: z.array(z.string()),
  filesToFix: z.array(z.object({
    filePath: z.string(),
    issues: z.array(z.string()),
    requireCodeChanges: z.boolean(),
  })),
  commands: z.array(z.string()),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type FileConcept = z.infer<typeof FileConceptSchema>;
export type PhaseConcept = z.infer<typeof PhaseConceptSchema>;
export type Blueprint = z.infer<typeof BlueprintSchema>;
export type FileOutput = z.infer<typeof FileOutputSchema>;
export type CodeReview = z.infer<typeof CodeReviewSchema>;

// ============================================================================
// STATE INTERFACES
// ============================================================================

export interface ActivePhase extends PhaseConcept {
  startedAt?: Date;
}

export interface FileState extends FileOutput {
  lastDiff: string;
  generatedAt: Date;
  updatedAt: Date;
}

export interface PhaseState extends PhaseConcept {
  completed: boolean;
  startedAt?: Date;
  completedAt?: Date;
  filesGenerated: string[];
  errors: string[];
}

export enum CurrentDevState {
  IDLE = 0,
  PHASE_GENERATING = 1,
  PHASE_IMPLEMENTING = 2,
  REVIEWING = 3,
  FINALIZING = 4,
  DEBUGGING = 5,
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
}

export interface RuntimeError {
  message: string;
  stack?: string;
  filePath?: string;
  line?: number;
  column?: number;
  timestamp: Date;
  type: 'compile' | 'runtime' | 'lint' | 'build';
}

export interface CommandLog {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  timestamp: Date;
  durationMs?: number;
  tags?: string[];
  provider?: string;
  sandboxId?: string;
  cwd?: string;
  meta?: Record<string, unknown>;
}

export interface AgentState {
  // Identifiers
  sessionId: string;
  userId?: string;
  projectId?: string;

  // Blueprint & Planning
  blueprint?: Blueprint;
  projectName: string;
  originalQuery: string;
  templateName?: string;

  // File State
  generatedFilesMap: Record<string, FileState>;
  generatedPhases: PhaseState[];

  // Execution State
  currentDevState: CurrentDevState;
  currentPhase?: ActivePhase;
  phasesCounter: number;
  mvpGenerated: boolean;
  reviewingInitiated: boolean;
  reviewCycles: number;

  // Agent Configuration
  agentMode: 'deterministic' | 'smart';
  shouldBeGenerating: boolean;
  isDebugging: boolean;

  // Sandbox State
  sandboxInstanceId?: string;
  sandboxProvider?: 'e2b' | 'vercel';
  hostname?: string;
  previewUrl?: string;

  // Command History
  commandsHistory: string[];
  lastPackageJson?: string;
  commandLogs: CommandLog[];

  // Conversation
  conversationMessages: ConversationMessage[];
  pendingUserInputs: string[];
  projectUpdatesAccumulator: string[];

  // Debugging
  lastDeepDebugTranscript?: string;
  runtimeErrors: RuntimeError[];
  clientReportedErrors: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface AgentStateUpdate {
  $set?: Partial<AgentState>;
  $push?: {
    conversationMessages?: ConversationMessage;
    commandsHistory?: string;
    generatedPhases?: PhaseState;
    runtimeErrors?: RuntimeError;
    commandLogs?: CommandLog;
    pendingUserInputs?: string;
    projectUpdatesAccumulator?: string;
  };
  $inc?: {
    phasesCounter?: number;
    reviewCycles?: number;
  };
}

// ============================================================================
// INITIALIZATION ARGS
// ============================================================================

export interface AgentInitArgs {
  sessionId: string;
  userId?: string;
  projectId?: string;
  query: string;
  templateName?: string;
  agentMode?: 'deterministic' | 'smart';
  sandboxProvider?: 'e2b' | 'vercel';
}

export interface PhaseGenerationArgs {
  phaseName: string;
  phaseDescription: string;
  requirements: string[];
  files: FileConcept[];
}

export interface FileRegenerationArgs {
  path: string;
  issues: string[];
}

export interface DeepDebugArgs {
  issue: string;
  focusPaths?: string[];
}



