import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

export class LLMEngine {
  private providers: Map<string, LLMProvider> = new Map();

  registerProvider(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    return provider;
  }

  async generate(providerName: string, messages: Message[], tools?: any[], options?: GenerateOptions): Promise<LLMResponse> {
    const provider = this.getProvider(providerName);
    return provider.generate(messages, tools, options);
  }
}
