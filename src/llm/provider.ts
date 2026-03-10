export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string; // used when role is 'tool' or 'assistant'
  toolCalls?: any[];   // used when role is 'assistant'
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMResponse {
  message: Message;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  generate(messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse>;
  generateStream?(messages: Message[], tools?: any[], options?: GenerateOptions): AsyncIterable<string>;
}
