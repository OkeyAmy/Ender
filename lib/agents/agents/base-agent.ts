/**
 * Base Agent
 * Foundation class for all LangChain-based agents
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentStateManager } from '../state/agent-state-manager';
import { StructuredTool } from '@langchain/core/tools';

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  maxIterations?: number;
  temperature?: number;
}

export interface AgentContext {
  stateManager: AgentStateManager;
  model: BaseChatModel;
  tools?: StructuredTool[];
}

export interface AgentInput {
  input: string;
  context?: Record<string, unknown>;
}

export interface AgentOutput {
  output: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * BaseAgent - Abstract base class for all agents
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context: AgentContext;
  protected messages: BaseMessage[] = [];

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return this.config.description;
  }

  /**
   * Initialize the agent with system prompt
   */
  protected initializeMessages(additionalContext?: string): void {
    let systemContent = this.config.systemPrompt;
    if (additionalContext) {
      systemContent += `\n\n${additionalContext}`;
    }
    this.messages = [new SystemMessage(systemContent)];
  }

  /**
   * Add a message to the conversation
   */
  protected addMessage(message: BaseMessage): void {
    this.messages.push(message);
  }

  /**
   * Get conversation history
   */
  protected getMessages(): BaseMessage[] {
    return this.messages;
  }

  /**
   * Clear conversation history
   */
  protected clearMessages(): void {
    this.messages = [];
  }

  /**
   * Create a prompt template
   */
  protected createPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ['system', this.config.systemPrompt],
      ['placeholder', '{messages}'],
    ]);
  }

  /**
   * Execute the agent
   */
  abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Stream execution (for real-time output)
   */
  async *executeStream(
    input: AgentInput
  ): AsyncGenerator<string, AgentOutput, undefined> {
    // Default implementation - override in subclasses for streaming
    const result = await this.execute(input);
    yield result.output;
    return result;
  }

  /**
   * Log agent activity
   */
  protected log(message: string, data?: Record<string, unknown>): void {
    console.log(`[${this.config.name}] ${message}`, data || '');
  }

  /**
   * Handle errors
   */
  protected handleError(error: unknown): AgentOutput {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log('Error occurred', { error: errorMessage });
    
    return {
      output: '',
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Parse AI response to extract structured data
   */
  protected parseResponse(response: AIMessage): string {
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  /**
   * Get the model
   */
  protected getModel(): BaseChatModel {
    return this.context.model;
  }

  /**
   * Get the state manager
   */
  protected getStateManager(): AgentStateManager {
    return this.context.stateManager;
  }

  /**
   * Get available tools
   */
  protected getTools(): StructuredTool[] {
    return this.context.tools || [];
  }
}

export default BaseAgent;





