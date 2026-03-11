import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

function normalizeGLMUsage(usage: any | undefined) {
  const promptTokens = usage?.promptTokens ?? usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
  const completionTokens = usage?.completionTokens ?? usage?.completion_tokens ?? usage?.output_tokens ?? 0;
  const totalTokens = usage?.totalTokens ?? usage?.total_tokens ?? (promptTokens + completionTokens);
  return { promptTokens, completionTokens, totalTokens };
}

// A provider implementation for Zhipu AI (GLM models)
export class GLMProvider implements LLMProvider {
  name = 'glm';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GLM_API_KEY || '';
    this.baseUrl = process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    this.defaultModel = process.env.GLM_MODEL || process.env.DEFAULT_MODEL_NAME || 'glm-4';

    if (!this.apiKey) {
      throw new Error('GLM_API_KEY is missing. Please set it in .env file.');
    }
  }

  async generate(messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse> {
    const payload: any = {
      model: options?.model || this.defaultModel,
      temperature: options?.temperature ?? 0.7,
      messages: messages.map(m => {
        const out: any = { role: m.role, content: m.content || (m.toolCalls ? null : '') };
        if (m.role === 'assistant' && m.toolCalls) {
          out.tool_calls = m.toolCalls;
        }
        if (m.role === 'tool' && m.toolCallId) {
          out.tool_call_id = m.toolCallId;
        }
        return out;
      }),
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      if (response.status === 400) {
        console.error('--- GLM 400 Payload Debug ---');
        console.error(JSON.stringify(payload, null, 2));
        console.error('-----------------------------');
      }
      throw new Error(`GLM API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    const outMsg: any = {
      role: message.role,
      content: message.content || '',
    };
    if (message.tool_calls) outMsg.toolCalls = message.tool_calls;

    return {
      message: outMsg,
      usage: normalizeGLMUsage(data.usage),
    };
  }

  async *generateStream(messages: Message[], tools?: any[], options?: GenerateOptions): AsyncIterable<string> {
    const payload: any = {
      model: options?.model || this.defaultModel,
      temperature: options?.temperature ?? 0.7,
      stream: true,
      messages: messages.map(m => {
        const out: any = { role: m.role, content: m.content || (m.toolCalls ? null : '') };
        if (m.role === 'assistant' && m.toolCalls) {
          out.tool_calls = m.toolCalls;
        }
        if (m.role === 'tool' && m.toolCallId) {
          out.tool_call_id = m.toolCallId;
        }
        return out;
      }),
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }

    // Not all fetch implementations support getReader() in Node.js properly without polyfill,
    // but assuming standard node fetch is used (Node 18+).
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`GLM API Stream Error: ${response.status} - ${errorData}`);
    }

    if (!response.body) {
        throw new Error('No response body from GLM API');
    }

    const body: any = response.body; 
    let reader: any;
    
    // Polyfill support for different Node fetch runtimes
    if (body.getReader) {
        reader = body.getReader();
    } else {
        // Fallback for some Node.js readable streams
        reader = body[Symbol.asyncIterator] ? body[Symbol.asyncIterator]() : null;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    if (reader && reader.read) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.choices && data.choices.length > 0) {
                            const delta = data.choices[0].delta;
                            if (delta && delta.content) {
                                yield delta.content;
                            }
                        }
                    } catch (e) {
                        // ignore JSON parse error for partial stream chunks
                    }
                }
            }
        }
    } else if (reader && body[Symbol.asyncIterator]) {
        for await (const chunk of body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.choices && data.choices.length > 0) {
                            const delta = data.choices[0].delta;
                            if (delta && delta.content) {
                                yield delta.content;
                            }
                        }
                    } catch (e) {
                         // ignore JSON parse error for partial stream chunks
                    }
                }
            }
        }
    } else {
        throw new Error('Stream reading not supported in current fetch implementation');
    }
  }
}
