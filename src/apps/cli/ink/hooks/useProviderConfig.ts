/**
 * Provider Configuration Module
 * Handles lazy loading and caching of providers and models
 */

import { checkApiKeyConfigured } from '../../../../agent/index.js';
import { showNotice, showSelectOne, showAsk } from '../components/modals/index.js';
import type { Api, Model } from '@mariozechner/pi-ai';

// 延迟加载 pi-ai 模块，避免启动时加载 13896 行的 models.generated.js
// 懒加载缓存
type AllowedProvider = 'zai' | 'minimax-cn';
let providersCache: AllowedProvider[] | null = null;
let modelsByProviderCache: Record<string, Model<Api>[]> | null = null;
let isLoadingCache = false;

// 同步获取 providers（如果已缓存）
export function getProviders(): string[] | null {
  return providersCache;
}

// 同步获取 models by provider（如果已缓存）
export function getModels(provider: string): Model<Api>[] | null {
  if (!modelsByProviderCache) return null;
  return modelsByProviderCache[provider] || null;
}

// 异步加载 providers
export async function ensureProvidersLoaded(): Promise<string[]> {
  if (providersCache) return providersCache;
  if (isLoadingCache) {
    // 等待加载完成（轮询）
    while (!providersCache) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return providersCache;
  }
  isLoadingCache = true;
  const { getProviders: gp, getModels: gm } = await import('@mariozechner/pi-ai');
  const ALLOWED_PROVIDERS = ['zai', 'minimax-cn'] as const;
  providersCache = (gp() as string[]).filter((p): p is AllowedProvider => ALLOWED_PROVIDERS.includes(p as AllowedProvider));
  modelsByProviderCache = {};
  for (const p of providersCache) {
    modelsByProviderCache[p] = gm(p);
  }
  isLoadingCache = false;
  return providersCache;
}

// 检查 API Key 是否已配置
export { checkApiKeyConfigured };

// 清除缓存（用于测试）
export function clearProviderCache(): void {
  providersCache = null;
  modelsByProviderCache = null;
  isLoadingCache = false;
}

// 显示 Provider 选择对话框
export function showProviderSelection(
  providers: string[],
  onSelect: (provider: string) => void,
  onCancel: () => void
): void {
  const choices = providers.map((provider) => ({
    value: provider,
    label: `${provider.toUpperCase()} ${checkApiKeyConfigured(provider) ? '[configured]' : '[api key required]'}`,
  }));

  showSelectOne({
    title: 'Select Provider',
    message: 'Choose the provider to configure.',
    choices,
    footer: '↑/↓ Navigate • Enter Select • Esc Cancel',
    onSubmit: (choice) => {
      onSelect(choice.value);
    },
    onCancel,
  });
}

// 显示 Model 选择对话框
export function showModelSelection(
  provider: string,
  models: Model<Api>[],
  onSelect: (model: Model<Api>) => void,
  onCancel: () => void
): void {
  if (!models || models.length === 0) {
    showNotice({ title: 'Model Configuration', message: `No models available for ${provider.toUpperCase()}.`, footer: 'Esc Close' });
    return;
  }

  const modelChoices = models.map((model) => ({
    value: model.id,
    label: model.id,
  }));

  showSelectOne({
    title: `Select Model • ${provider.toUpperCase()}`,
    message: 'Choose the model to use for new prompts.',
    choices: modelChoices,
    footer: '↑/↓ Navigate • Enter Select • Esc Cancel',
    emptyLabel: 'No models available',
    onSubmit: (modelChoice) => {
      const selectedModel = models.find((model) => model.id === modelChoice.value);
      if (!selectedModel) {
        onCancel();
        return;
      }
      onSelect(selectedModel);
    },
    onCancel,
  });
}

// 显示 API Key 输入对话框
export function showApiKeyInput(
  provider: string,
  onSubmit: (apiKey: string) => void,
  onCancel: () => void
): void {
  showAsk({
    title: `API Key • ${provider.toUpperCase()}`,
    message: 'Enter the provider API key.',
    footer: 'Type to edit • Enter Save • Esc Cancel',
    onSubmit: (value) => {
      if (!value.trim()) {
        showNotice({ title: 'Model Configuration', message: 'API key cannot be empty.', footer: 'Esc Close' });
        return;
      }
      onSubmit(value.trim());
    },
    onCancel,
  });
}
