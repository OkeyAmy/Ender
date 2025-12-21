/**
 * Agent Tools System
 * LangChain tools for multi-agent operations
 */

import { StructuredTool } from '@langchain/core/tools';
import { AgentStateManager } from '../state/agent-state-manager';
import { createSandboxTools } from './sandbox-tools';
import { createFileTools } from './file-tools';

// Re-export individual tools
export * from './sandbox-tools';
export * from './file-tools';
export * from './validation-tools';

/**
 * Create all debug tools for autonomous debugging
 */
export function createDebugTools(stateManager: AgentStateManager): StructuredTool[] {
  return [
    ...createSandboxTools(),
    ...createFileTools(stateManager),
  ];
}

/**
 * Create all build tools for build monitoring
 */
export function createBuildTools(): StructuredTool[] {
  return createSandboxTools();
}

/**
 * Create code generation tools
 */
export function createCodeGenTools(stateManager: AgentStateManager): StructuredTool[] {
  return createFileTools(stateManager);
}

/**
 * Create all available tools
 */
export function createAllTools(stateManager: AgentStateManager): StructuredTool[] {
  return [
    ...createSandboxTools(),
    ...createFileTools(stateManager),
  ];
}

/**
 * Tool categories for organization
 */
export const ToolCategories = {
  sandbox: ['run_command', 'deploy_preview', 'run_analysis', 'get_runtime_errors', 'get_logs', 'wait'],
  files: ['read_files', 'write_file', 'list_files', 'regenerate_file', 'generate_files', 'search_files', 'delete_file'],
  validation: ['validate_environment', 'run_lint', 'run_typecheck'],
} as const;

/**
 * Filter tools by category
 */
export function getToolsByCategory(
  tools: StructuredTool[],
  category: keyof typeof ToolCategories
): StructuredTool[] {
  const categoryTools = ToolCategories[category] as readonly string[];
  return tools.filter(tool => categoryTools.includes(tool.name));
}

/**
 * Get tool names for a category
 */
export function getToolNames(category: keyof typeof ToolCategories): string[] {
  return [...ToolCategories[category]];
}

export default {
  createDebugTools,
  createBuildTools,
  createCodeGenTools,
  createAllTools,
  ToolCategories,
  getToolsByCategory,
  getToolNames,
};



