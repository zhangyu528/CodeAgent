import { LLMEngine } from './engine';
import { GLMProvider } from './glm_provider';
import { OpenAIProvider } from './openai_provider';
import { AnthropicProvider } from './anthropic_provider';
import { DeepSeekProvider } from './deepseek_provider';
import { OllamaProvider } from './ollama_provider';

export type ProviderRegistrationResult = {
  registered: string[];
  skipped: { name: string; reason: string }[];
};

function hasAnyEnv(keys: string[]) {
  return keys.some(k => !!process.env[k]);
}

function hasAllEnv(keys: string[]) {
  return keys.every(k => !!process.env[k]);
}

export function registerProvidersFromEnv(engine: LLMEngine): ProviderRegistrationResult {
  const registered: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  // Legacy GLM provider (kept for backward compatibility with existing tests/docs)
  if (process.env.GLM_API_KEY) {
    engine.registerProvider(new GLMProvider(process.env.GLM_API_KEY));
    registered.push('glm');
  }

  if (hasAnyEnv(['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BASE_URL'])) {
    if (hasAllEnv(['OPENAI_API_KEY', 'OPENAI_MODEL'])) {
      engine.registerProvider(new OpenAIProvider());
      registered.push('openai');
    } else {
      skipped.push({ name: 'openai', reason: 'Missing OPENAI_API_KEY or OPENAI_MODEL.' });
    }
  }

  if (hasAnyEnv(['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL'])) {
    if (hasAllEnv(['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'])) {
      engine.registerProvider(new AnthropicProvider());
      registered.push('anthropic');
    } else {
      skipped.push({ name: 'anthropic', reason: 'Missing ANTHROPIC_API_KEY or ANTHROPIC_MODEL.' });
    }
  }

  if (hasAnyEnv(['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_BASE_URL'])) {
    if (hasAllEnv(['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'])) {
      engine.registerProvider(new DeepSeekProvider());
      registered.push('deepseek');
    } else {
      skipped.push({ name: 'deepseek', reason: 'Missing DEEPSEEK_API_KEY or DEEPSEEK_MODEL.' });
    }
  }

  if (hasAnyEnv(['OLLAMA_BASE_URL', 'OLLAMA_MODEL'])) {
    if (hasAllEnv(['OLLAMA_BASE_URL', 'OLLAMA_MODEL'])) {
      engine.registerProvider(new OllamaProvider());
      registered.push('ollama');
    } else {
      skipped.push({ name: 'ollama', reason: 'Missing OLLAMA_BASE_URL or OLLAMA_MODEL.' });
    }
  }

  return { registered, skipped };
}
