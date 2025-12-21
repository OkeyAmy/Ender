/**
 * Agent System
 * Multi-agent architecture for autonomous code generation
 */

export * from './base-agent';
export * from './orchestrator-agent';
export * from './codegen-agent';
export * from './debug-agent';
export * from './review-agent';

// Re-export main classes
export { BaseAgent } from './base-agent';
export { OrchestratorAgent } from './orchestrator-agent';
export { CodeGenAgent } from './codegen-agent';
export { DebugAgent } from './debug-agent';
export { ReviewAgent } from './review-agent';

// Agent types
export type AgentType = 'orchestrator' | 'codegen' | 'debug' | 'review' | 'build';

// Agent factory
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AgentStateManager } from '../state/agent-state-manager';
import { OrchestratorAgent } from './orchestrator-agent';
import { CodeGenAgent } from './codegen-agent';
import { DebugAgent } from './debug-agent';
import { ReviewAgent } from './review-agent';
import { StructuredTool } from '@langchain/core/tools';

export interface AgentFactoryConfig {
  stateManager: AgentStateManager;
  model: BaseChatModel;
  tools?: StructuredTool[];
}

/**
 * Create an agent instance by type
 */
export function createAgent(type: AgentType, config: AgentFactoryConfig) {
  const context = {
    stateManager: config.stateManager,
    model: config.model,
    tools: config.tools,
  };

  switch (type) {
    case 'orchestrator':
      return new OrchestratorAgent(context);
    case 'codegen':
      return new CodeGenAgent(context);
    case 'debug':
      return new DebugAgent(context);
    case 'review':
      return new ReviewAgent(context);
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

/**
 * Create all agents for a session
 */
export function createAllAgents(config: AgentFactoryConfig) {
  return {
    orchestrator: new OrchestratorAgent({
      stateManager: config.stateManager,
      model: config.model,
    }),
    codegen: new CodeGenAgent({
      stateManager: config.stateManager,
      model: config.model,
    }),
    debug: new DebugAgent({
      stateManager: config.stateManager,
      model: config.model,
      tools: config.tools,
    }),
    review: new ReviewAgent({
      stateManager: config.stateManager,
      model: config.model,
    }),
  };
}





