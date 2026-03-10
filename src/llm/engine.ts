import type { GenerateOptions, LLMResponse, Message } from "../types.js";
import type { LLMProvider } from "./provider.js";

export class LLMEngine {
  private providers = new Map<string, LLMProvider>();

  registerProvider(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`LLM provider not found: ${name}`);
    }
    return provider;
  }

  async generate(
    providerName: string,
    messages: Message[],
    options: GenerateOptions
  ): Promise<LLMResponse> {
    return this.getProvider(providerName).generate(messages, options);
  }
}
