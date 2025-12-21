import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export interface ModelConfig {
  provider: 'openai' | 'groq' | 'anthropic' | 'custom' | 'google';
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
}

/**
 * Factory to create LangChain chat models based on configuration.
 * Supports OpenAI-compatible endpoints (Groq, etc.) via ChatOpenAI.
 */
export class ModelFactory {
  /**
   * Convenience helper to parse model strings like "google/gemini-flash-latest"
   * into a ModelConfig while allowing overrides.
   */
  static fromModelId(modelId: string, overrides: Partial<ModelConfig> = {}): ModelConfig {
    const [providerCandidate, ...rest] = (modelId || '').split('/');
    const provider: ModelConfig['provider'] =
      ['openai', 'groq', 'anthropic', 'custom', 'google'].includes(providerCandidate)
        ? (providerCandidate as ModelConfig['provider'])
        : 'openai';

    const modelName = rest.length > 0 ? rest.join('/') : (overrides.modelName || modelId);

    return {
      provider,
      modelName,
      ...overrides,
    };
  }

  static create(config: ModelConfig): BaseChatModel {
    const temperature = config.temperature ?? 0;
    const aiGatewayBaseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1';

    switch (config.provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: config.modelName,
          openAIApiKey: config.apiKey || process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
          configuration: config.apiKey === process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY
            ? { baseURL: config.baseUrl || aiGatewayBaseUrl }
            : config.baseUrl
              ? { baseURL: config.baseUrl }
              : undefined,
          temperature,
        });

      case 'groq':
        return new ChatOpenAI({
          modelName: config.modelName,
          openAIApiKey: config.apiKey || process.env.GROQ_API_KEY,
          configuration: {
            baseURL: 'https://api.groq.com/openai/v1',
          },
          temperature,
        });

      case 'custom':
        // Generic OpenAI-compatible provider
        return new ChatOpenAI({
          modelName: config.modelName,
          openAIApiKey: config.apiKey,
          configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
          temperature,
        });

      case 'anthropic': {
        const apiKey = config.apiKey || process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY;
        const baseURL = config.baseUrl || (process.env.AI_GATEWAY_API_KEY ? aiGatewayBaseUrl : process.env.ANTHROPIC_BASE_URL);

        if (!baseURL) {
          throw new Error('Anthropic provider requires either AI_GATEWAY_API_KEY or a compatible baseUrl.');
        }

        return new ChatOpenAI({
          modelName: config.modelName,
          openAIApiKey: apiKey,
          configuration: { baseURL },
          temperature,
        });
      }

      case 'google':
        return new ChatGoogleGenerativeAI({
          model: config.modelName,
          apiKey: config.apiKey || process.env.AI_GATEWAY_API_KEY || process.env.GEMINI_API_KEY,
          baseUrl: config.baseUrl || (process.env.AI_GATEWAY_API_KEY ? aiGatewayBaseUrl : undefined),
          temperature,
        });

      // Add other providers as needed (e.g. Anthropic via @langchain/anthropic if installed)

      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
