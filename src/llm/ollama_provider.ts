import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

function normalizeOllamaUsage(data: any | undefined) {
  const promptTokens = data?.prompt_eval_count ?? 0;
  const completionTokens = data?.eval_count ?? 0;
  const totalTokens = promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function ensureOllamaChatUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/chat')) return trimmed;
  return `${trimmed}/api/chat`;
}

// Local Ollama provider (`/api/chat`)
export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private defaultModel: string;

  constructor(opts?: { baseUrl?: string; model?: string }) {
    this.baseUrl = opts?.baseUrl || process.env.OLLAMA_BASE_URL || '';
    this.defaultModel = opts?.model || process.env.OLLAMA_MODEL || '';

    if (!this.baseUrl) throw new Error('OLLAMA_BASE_URL is missing. Please set it in .env file.');
    if (!this.defaultModel) throw new Error('OLLAMA_MODEL is missing. Please set it in .env file.');
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.models || []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }

  setModel(model: string): void {
    this.defaultModel = model;
  }

  getModel(): string {
    return this.defaultModel;
  }

  async generate(messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse> {
    const payload: any = {
      model: options?.model || this.defaultModel,
      stream: false,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content || '',
      })),
      options: {
        temperature: options?.temperature ?? 0.7,
      },
    };

    if (tools && tools.length > 0) payload.tools = tools;

    const response = await fetch(ensureOllamaChatUrl(this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const message = data?.message;
    if (!message) throw new Error('Ollama API Error: missing message');

    const outMsg: any = {
      role: message.role,
      content: message.content || '',
    };
    if (message.tool_calls) outMsg.toolCalls = message.tool_calls;

    return {
      message: outMsg,
      usage: normalizeOllamaUsage(data),
    };
  }
}
