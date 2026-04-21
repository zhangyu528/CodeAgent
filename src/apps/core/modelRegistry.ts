/**
 * Model Registry API - facade for agent's ModelRegistry
 */

import { ModelRegistry } from '@mariozechner/pi-coding-agent';
import { logger } from './logger.js';
import { getAuthStorage } from './auth.js';

type AllowedProvider = 'zai' | 'minimax-cn';

let modelRegistryInstance: ModelRegistry | null = null;
let providersCache: AllowedProvider[] | null = null;
let modelsByProviderCache: Record<string, any[]> | null = null;
let isLoadingCache = false;

export function getModelRegistry(): ModelRegistry {
  if (!modelRegistryInstance) {
    modelRegistryInstance = new ModelRegistry(getAuthStorage());
  }
  return modelRegistryInstance;
}

export function getProviders(): string[] | null {
  return providersCache;
}

export function getModels(provider: string): any[] | null {
  if (!modelsByProviderCache) return null;
  return modelsByProviderCache[provider] || null;
}

export async function ensureProvidersLoaded(): Promise<string[]> {
  if (providersCache) return providersCache;
  if (isLoadingCache) {
    while (!providersCache) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return providersCache;
  }
  isLoadingCache = true;

  const registry = getModelRegistry();
  registry.refresh();
  const allModels = registry.getAll();
  const ALLOWED_PROVIDERS: AllowedProvider[] = ['zai', 'minimax-cn'];

  const providerSet = new Set<AllowedProvider>();
  modelsByProviderCache = {};

  for (const model of allModels) {
    if (ALLOWED_PROVIDERS.includes(model.provider as AllowedProvider)) {
      providerSet.add(model.provider as AllowedProvider);
      if (!modelsByProviderCache[model.provider]) {
        modelsByProviderCache[model.provider] = [];
      }
      modelsByProviderCache[model.provider]!.push(model);
    }
  }

  providersCache = Array.from(providerSet);
  isLoadingCache = false;
  return providersCache;
}

// 清除缓存（用于测试）
export function clearProviderCache(): void {
  modelRegistryInstance = null;
  providersCache = null;
  modelsByProviderCache = null;
  isLoadingCache = false;
}

// 重新加载 providers 和 models（用于 API key 变更后刷新）
export async function reloadProviders(): Promise<string[]> {
  logger.info('[ModelRegistry] Reloading providers...');
  clearProviderCache();
  const providers = await ensureProvidersLoaded();
  logger.info(`[ModelRegistry] Loaded providers: ${providers.join(', ')}`);
  return providers;
}
