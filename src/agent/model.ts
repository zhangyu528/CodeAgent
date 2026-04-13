/**
 * Model Resolution (internal to agent)
 */
import { getModel, getModels } from '@mariozechner/pi-ai';
import type { Model, KnownProvider, Api } from '@mariozechner/pi-ai';

class ModelResolver {
  private overrides: Record<string, { baseUrl?: string; api?: string }> = {
    minimax: {},
  };

  /** Returns resolved model config with env overrides applied, or null if no provider configured */
  resolve(): Model<Api> | null {
    const provider = this.resolveEnvProvider();
    if (!provider) return null;

    const modelId = this.resolveModelId(provider);
    const model = modelId ? this.resolveModelFromEnv(provider, modelId) : null;
    const fallback = this.resolveFallbackModel(provider);
    const resolved = model || fallback;

    if (!resolved) return null;

    const override = this.overrides[provider as KnownProvider];
    const withOverrides = override
      ? { ...resolved, api: override.api || resolved.api, baseUrl: override.baseUrl || resolved.baseUrl }
      : resolved;

    return this.applyEnvOverrides(withOverrides, provider);
  }

  private resolveEnvProvider(): string | undefined {
    return process.env.DEFAULT_PROVIDER;
  }

  private resolveModelId(provider: string): string | null {
    const envModelKey = `${provider.toUpperCase().replace(/-/g, '_')}_MODEL`;
    return process.env[envModelKey] || null;
  }

  private resolveModelFromEnv(provider: string, modelId: string): Model<Api> | null {
    try {
      return getModel(provider as KnownProvider, modelId as Parameters<typeof getModel>[1]);
    } catch {
      return null;
    }
  }

  private resolveFallbackModel(provider: string): Model<Api> | null {
    try {
      const models = getModels(provider as KnownProvider);
      return models.length > 0 ? models[0]! : null;
    } catch {
      return null;
    }
  }

  private applyEnvOverrides(model: Model<Api>, provider: string): Model<Api> {
    const providerUpper = provider.toUpperCase().replace(/-/g, '_');
    const envBaseUrl = process.env[`${providerUpper}_BASE_URL`];
    const envApi = process.env[`${providerUpper}_API`];

    return {
      ...model,
      api: envApi || model.api,
      baseUrl: envBaseUrl || model.baseUrl,
    };
  }
}

export const modelResolver = new ModelResolver();