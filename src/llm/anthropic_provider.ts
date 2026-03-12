import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

function normalizeAnthropicUsage(usage: any | undefined) {
  const promptTokens = usage?.promptTokens ?? usage?.input_tokens ?? 0;
  const completionTokens = usage?.completionTokens ?? usage?.output_tokens ?? 0;
  const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
  return { promptTokens, completionTokens, totalTokens };
}

function splitSystem(messages: Message[]) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const rest = messages.filter(m => m.role !== 'system');
  return { system, rest };
}

function toAnthropicTools(tools: any[] | undefined) {
  if (!tools || tools.length === 0) return undefined;
  return tools
    .filter(t => t?.type === 'function' && t?.function?.name)
    .map(t => ({
      name: t.function.name,
      description: t.function.description || '',
      input_schema: t.function.parameters || { type: 'object', properties: {} },
    }));
}

function toAnthropicMessages(messages: Message[]) {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId || '',
            content: m.content || '',
          },
        ],
      });
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });

      for (const tc of m.toolCalls) {
        const name = tc?.function?.name;
        const rawArgs = tc?.function?.arguments;
        let input: any = {};

        if (typeof rawArgs === 'string' && rawArgs.trim() !== '') {
          try {
            input = JSON.parse(rawArgs);
          } catch {
            input = { _raw: rawArgs };
          }
        } else if (rawArgs && typeof rawArgs === 'object') {
          input = rawArgs;
        }

        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name,
          input,
        });
      }

      out.push({ role: 'assistant', content: blocks });
      continue;
    }

    out.push({ role: m.role, content: m.content || '' });
  }
  return out;
}

function fromAnthropicContent(content: any) {
  const blocks: any[] = Array.isArray(content) ? content : [];

  const text = blocks
    .filter(b => b?.type === 'text')
    .map(b => b.text || '')
    .join('');

  const toolCalls = blocks
    .filter(b => b?.type === 'tool_use')
    .map(b => ({
      id: b.id,
      type: 'function',
      function: {
        name: b.name,
        arguments: JSON.stringify(b.input ?? {}),
      },
    }));

  return { text, toolCalls };
}

// Anthropic Messages provider (`/v1/messages`)
export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = opts?.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = opts?.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages';
    this.defaultModel = opts?.model || process.env.ANTHROPIC_MODEL || '';

    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is missing. Please set it in .env file.');
    if (!this.defaultModel) throw new Error('ANTHROPIC_MODEL is missing. Please set it in .env file.');
  }

  async generate(messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse> {
    const { system, rest } = splitSystem(messages);
    const anthropicTools = toAnthropicTools(tools);

    const payload: any = {
      model: options?.model || this.defaultModel,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      messages: toAnthropicMessages(rest),
    };

    if (system) payload.system = system;
    if (anthropicTools && anthropicTools.length > 0) payload.tools = anthropicTools;

    const init: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'tools-2024-04-04',
      },
      body: JSON.stringify(payload),
    };
    if (options?.signal) init.signal = options.signal;

    const response = await fetch(this.baseUrl, init);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const parsed = fromAnthropicContent(data?.content);

    const outMsg: any = {
      role: 'assistant',
      content: parsed.text || '',
    };
    if (parsed.toolCalls.length > 0) outMsg.toolCalls = parsed.toolCalls;

    return {
      message: outMsg,
      usage: normalizeAnthropicUsage(data?.usage),
    };
  }
}
