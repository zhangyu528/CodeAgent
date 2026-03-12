import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

function normalizeOpenAIUsage(usage: any | undefined) {
  const promptTokens = usage?.promptTokens ?? usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completionTokens ?? usage?.completion_tokens ?? 0;
  const totalTokens = usage?.totalTokens ?? usage?.total_tokens ?? (promptTokens + completionTokens);
  return { promptTokens, completionTokens, totalTokens };
}

function toOpenAIMessages(messages: Message[]) {
  return messages.map(m => {
    const out: any = { role: m.role, content: m.content || (m.toolCalls ? null : '') };
    if (m.role === 'assistant' && m.toolCalls) out.tool_calls = m.toolCalls;
    if (m.role === 'tool' && m.toolCallId) out.tool_call_id = m.toolCallId;
    return out;
  });
}

// DeepSeek is OpenAI-compatible for Chat Completions
export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts?.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = opts?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions';
    this.defaultModel = opts?.model || process.env.DEEPSEEK_MODEL || '';

    if (!this.apiKey) throw new Error('DEEPSEEK_API_KEY is missing. Please set it in .env file.');
    if (!this.defaultModel) throw new Error('DEEPSEEK_MODEL is missing. Please set it in .env file.');
  }

  async generate(messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse> {
    const payload: any = {
      model: options?.model || this.defaultModel,
      temperature: options?.temperature ?? 0.7,
      messages: toOpenAIMessages(messages),
    };

    if (tools && tools.length > 0) payload.tools = tools;

    const init: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    };
    if (options?.signal) init.signal = options.signal;

    const response = await fetch(this.baseUrl, init);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error('DeepSeek API Error: missing choices[0].message');

    const outMsg: any = {
      role: message.role,
      content: message.content || '',
    };
    if (message.tool_calls) outMsg.toolCalls = message.tool_calls;

    return {
      message: outMsg,
      usage: normalizeOpenAIUsage(data.usage),
    };
  }
}
