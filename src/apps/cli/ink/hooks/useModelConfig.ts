import { useState, useCallback, useEffect } from 'react';
import { Agent } from '@mariozechner/pi-agent-core';
import { checkApiKeyConfigured, saveApiKey, saveModelConfig } from '../../../../agent/index.js';
import { showNotice, showAsk, showSelectOne } from '../components/modals/index.js';
import { useAppStore } from '../store/uiStore.js';

// 延迟加载 pi-ai 模块，避免启动时加载 13896 行的 models.generated.js
// 懒加载缓存
type AllowedProvider = 'zai' | 'minimax-cn';
let providersCache: AllowedProvider[] | null = null;
let modelsByProviderCache: Record<string, any[]> | null = null;
let isLoadingCache = false;

export type ConfigStep = 'idle' | 'selecting_provider' | 'entering_api_key' | 'selecting_model';

export interface UseModelConfigResult {
  step: ConfigStep;
  isActive: boolean;
  pendingCommand: string | null;
  isLoading: boolean;  // 是否正在加载模型列表
  startConfig: (pendingCommand?: string) => void;
  cancelConfig: () => void;
}

// 同步获取 providers（如果已缓存）
function getProviders(): string[] | null {
  return providersCache;
}

// 同步获取 models by provider（如果已缓存）
function getModels(provider: string): any[] | null {
  if (!modelsByProviderCache) return null;
  return modelsByProviderCache[provider] || null;
}

// 异步加载 providers
async function ensureProvidersLoaded(): Promise<string[]> {
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

export function useModelConfig(agent: Agent): UseModelConfigResult {
  const [step, setStep] = useState<ConfigStep>('idle');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [configTriggered, setConfigTriggered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const setCurrentModel = useAppStore(state => state.setCurrentModel);

  const startConfig = useCallback((cmd?: string) => {
    setPendingCommand(cmd || null);
    setStep('selecting_provider');
    setConfigTriggered(true);
    setIsLoading(true);
    setLoadError(null);
    // 触发异步加载
    ensureProvidersLoaded()
      .then(() => {
        setIsLoading(false);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to load providers');
        setIsLoading(false);
      });
  }, []);

  const cancelConfig = useCallback(() => {
    setStep('idle');
    setSelectedProvider(null);
    setPendingCommand(null);
    setConfigTriggered(false);
    setLoadError(null);
  }, []);

  useEffect(() => {
    if (!configTriggered) return;

    if (isLoading) {
      showNotice(
        'Model Configuration',
        'Loading available providers and models...',
        'Esc Cancel',
      );
      return;
    }

    if (loadError) {
      showNotice(
        'Model Configuration',
        `Failed to load providers.\n${loadError}`,
        'Esc Close',
      );
      return;
    }

    const providers = getProviders();
    if (!providers || step === 'idle') return;

    if (step === 'selecting_provider') {
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
          const provider = choice.value;
          setSelectedProvider(provider);

          if (!checkApiKeyConfigured(provider)) {
            setStep('entering_api_key');
            return;
          }

          const models = getModels(provider);
          if (!models || models.length === 0) {
            showNotice('Model Configuration', `No models available for ${provider.toUpperCase()}.`, 'Esc Close');
            return;
          }

          setStep('selecting_model');
        },
        onCancel: cancelConfig,
      });
      return;
    }

    if (step === 'entering_api_key' && selectedProvider) {
      showAsk({
        title: `API Key • ${selectedProvider.toUpperCase()}`,
        message: 'Enter the provider API key.',
        footer: 'Type to edit • Enter Save • Esc Cancel',
        onSubmit: (value) => {
          if (!value.trim()) {
            showNotice('Model Configuration', 'API key cannot be empty.', 'Esc Close');
            return;
          }

          saveApiKey(selectedProvider, value.trim());
          const models = getModels(selectedProvider);
          if (!models || models.length === 0) {
            showNotice('Model Configuration', `No models available for ${selectedProvider.toUpperCase()}.`, 'Esc Close');
            return;
          }

          setStep('selecting_model');
        },
        onCancel: cancelConfig,
      });
      return;
    }

    if (step === 'selecting_model' && selectedProvider) {
      const models = getModels(selectedProvider) || [];
      const choices = models.map((model: any) => ({
        value: model.id,
        label: model.id,
      }));

      showSelectOne({
        title: `Select Model • ${selectedProvider.toUpperCase()}`,
        message: 'Choose the model to use for new prompts.',
        choices,
        footer: '↑/↓ Navigate • Enter Select • Esc Cancel',
        emptyLabel: 'No models available',
        onSubmit: (choice) => {
          const selectedModel = models.find((model: any) => model.id === choice.value);
          if (!selectedModel) {
            cancelConfig();
            return;
          }

          agent.setModel(selectedModel as any);
          saveModelConfig(selectedModel.provider, selectedModel.id);
          setCurrentModel(selectedModel.id);
          cancelConfig();
        },
        onCancel: cancelConfig,
      });
    }
  }, [agent, cancelConfig, configTriggered, isLoading, loadError, selectedProvider, setCurrentModel, step]);

  return {
    step,
    isActive: step !== 'idle',
    pendingCommand,
    isLoading,
    startConfig,
    cancelConfig,
  };
}
