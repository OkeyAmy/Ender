import { commandLogBus, CommandLogEvent } from '../sandbox/telemetry/command-log-bus';
import { ModelFactory } from './models/model-factory';
import { validationTools } from './tools/validation-tools';
import { FIX_BUILD_ERROR_PROMPT } from './prompts/self-fix-prompt';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages/tool';
import { StructuredToolInterface } from '@langchain/core/tools';
import { appConfig } from '@/config/app.config';

interface FeedbackLoopConfig {
    enabled: boolean;
    maxRetries: number;
    modelConfig: {
        provider: 'openai' | 'groq' | 'custom' | 'google' | 'anthropic';
        modelName: string;
        apiKey?: string;
    };
}

export class AIFeedbackLoop {
    private config: FeedbackLoopConfig = {
        enabled: true,
        maxRetries: 3,
        modelConfig: ModelFactory.fromModelId(appConfig.ai.defaultModel, {
            apiKey: process.env.AI_GATEWAY_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
        }) as FeedbackLoopConfig['modelConfig'],
    };
    private isRunning = false;

    constructor() {
        // Subscribe to command logs
        commandLogBus.subscribe(this.handleCommandLog.bind(this));
    }

    configure(config: Partial<FeedbackLoopConfig>) {
        this.config = { ...this.config, ...config };
    }

    private async handleCommandLog(event: CommandLogEvent) {
        if (!this.config.enabled || this.isRunning) return;

        // We only care about failed commands that are significant (build, test, etc.)
        if (!event.success && this.isSignificantCommand(event.command)) {
            console.log(`[AIFeedbackLoop] Detected failure in command: ${event.command}`);
            await this.attemptSelfFix(event);
        }
    }

    private isSignificantCommand(command: string): boolean {
        // Check if command is build, test, lint, or typecheck
        return /npm run (build|test|lint|typecheck)/.test(command) || /tsc/.test(command) || /vite build/.test(command);
    }

    private async attemptSelfFix(event: CommandLogEvent) {
        this.isRunning = true;
        (global as any).aiFeedbackLoopRunning = true;

        try {
            console.log('[AIFeedbackLoop] Starting self-fix attempt...');

            const model = ModelFactory.create(this.config.modelConfig);
            const modelWithTools = 'bindTools' in model && typeof model.bindTools === 'function'
                ? model.bindTools(validationTools)
                : model;

            const messages = await FIX_BUILD_ERROR_PROMPT.formatMessages({
                logs: `Command: ${event.command}\nStdout: ${event.stdout}\nStderr: ${event.stderr}`,
                validation: 'Pending validation...',
            });

            let iterations = 0;
            while (iterations < this.config.maxRetries) {
                const response = await modelWithTools.invoke(messages);
                messages.push(response);

                if (response.tool_calls && response.tool_calls.length > 0) {
                    console.log(`[AIFeedbackLoop] Agent requested ${response.tool_calls.length} tool(s)`);

                    for (const toolCall of response.tool_calls) {
                        const tool = validationTools.find(t => t.name === toolCall.name) as StructuredToolInterface | undefined;
                        if (tool) {
                            console.log(`[AIFeedbackLoop] Executing tool: ${tool.name}`);
                            try {
                                const toolCallPayload: ToolCall = {
                                    id: toolCall.id ?? tool.name,
                                    name: toolCall.name,
                                    args: toolCall.args ?? {},
                                };
                                const result = await tool.invoke(toolCallPayload);
                                messages.push(new ToolMessage({
                                    tool_call_id: toolCall.id ?? toolCall.name,
                                    content: result,
                                }));
                            } catch (error) {
                                messages.push(new ToolMessage({
                                    tool_call_id: toolCall.id ?? toolCall.name,
                                    content: `Error executing tool: ${(error as Error).message}`,
                                }));
                            }
                        } else {
                            messages.push(new ToolMessage({
                                tool_call_id: toolCall.id ?? toolCall.name,
                                content: `Error: Tool ${toolCall.name} not found`,
                            }));
                        }
                    }
                } else {
                    // No more tool calls, we are done
                    console.log('[AIFeedbackLoop] Agent finished self-fix attempt.');
                    break;
                }

                iterations++;
            }

            // After fix, verify if the command passes now
            const provider = sandboxManager.getActiveProvider();
            if (provider) {
                console.log(`[AIFeedbackLoop] Verifying fix by re-running: ${event.command}`);
                const verifyResult = await provider.runCommand(event.command);
                if (verifyResult.exitCode === 0) {
                    console.log('[AIFeedbackLoop] Fix verified! Command succeeded.');
                } else {
                    console.log('[AIFeedbackLoop] Fix verification failed.');
                }
            }

        } catch (error) {
            console.error('[AIFeedbackLoop] Error during self-fix:', error);
        } finally {
            this.isRunning = false;
            (global as any).aiFeedbackLoopRunning = false;
        }
    }
}

export const aiFeedbackLoop = new AIFeedbackLoop();
