import { LLMProvider, Message, GenerateOptions, LLMResponse } from './provider';

export class LLMEngine {
  private providers: Map<string, LLMProvider> = new Map();

  registerProvider(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys()).sort();
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

  async *generateStream(providerName: string, messages: Message[], tools?: any[], options?: GenerateOptions): AsyncIterable<string> {
    const provider = this.getProvider(providerName);
    if (!provider.generateStream) {
      throw new Error(`Provider ${providerName} does not support streaming`);
    }
    yield* provider.generateStream(messages, tools, options);
  }
}
