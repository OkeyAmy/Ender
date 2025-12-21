/**
 * Multi-Agent System
 * Complete agentic AI code generation architecture
 */

// State Management
export * from './state';
export { AgentStateManager } from './state/agent-state-manager';
export { PhaseManager } from './state/phase-manager';
export { FileManager } from './state/file-manager';

// Agents
export * from './agents';
export { OrchestratorAgent } from './agents/orchestrator-agent';
export { CodeGenAgent } from './agents/codegen-agent';
export { DebugAgent } from './agents/debug-agent';
export { ReviewAgent } from './agents/review-agent';
export { createAgent, createAllAgents } from './agents';

// Tools
export * from './tools';
export { createDebugTools, createBuildTools, createAllTools } from './tools';

// Assistants
export * from './assistants';
export { DeepDebugger } from './assistants/deep-debugger';

// Core Generators
export * from './core-generators';

// WebSocket
export * from './websocket';
export { agentWebSocketHandler } from './websocket/agent-websocket-handler';

// Legacy exports for compatibility
export * from './ai-feedback-loop';
export type {
  BuildAgentOutput,
  OrchestratorDecision as MultiAgentOrchestratorDecision,
} from './multi-agent-orchestrator';
export {
  createBuildAgent,
  createOrchestratorAgent,
  runMultiAgentCycle,
} from './multi-agent-orchestrator';

