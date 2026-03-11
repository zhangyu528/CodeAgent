import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

// A provider implementation for Zhipu AI (GLM models)
export class GLMProvider implements LLMProvider {
  name = 'glm';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GLM_API_KEY || '';
    this.baseUrl = process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    
    if (!this.apiKey) {
      throw new Error('GLM_API_KEY is missing. Please set it in .env file.');
    }
  }

  async generate(messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse> {
    const payload: any = {
      model: options?.model || 'glm-4',
      temperature: options?.temperature ?? 0.7,
      messages: messages.map(m => {
        const out: any = { role: m.role, content: m.content || (m.toolCalls ? null : "") };
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
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
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

    return {
      message: {
        role: message.role,
        content: message.content || '',
        toolCalls: message.tool_calls
      },
      usage: data.usage
    };
  }
}
