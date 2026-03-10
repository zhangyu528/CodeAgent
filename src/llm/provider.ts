import type { GenerateOptions, LLMResponse, Message } from "../types.js";

export interface LLMProvider {
  name: string;
  generate(messages: Message[], options: GenerateOptions): Promise<LLMResponse>;
}
