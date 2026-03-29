import { useState, useCallback, useMemo } from 'react';
import { Agent } from '@mariozechner/pi-agent-core';
import { checkApiKeyConfigured, saveApiKey, saveModelConfig } from '../../../../core/pi/factory.js';
import { ModalState } from '../components/overlays/types.js';

// 延迟加载 pi-ai 模块，避免启动时加载 13896 行的 models.generated.js
// 懒加载缓存
let providersCache: string[] | null = null;
let modelsByProviderCache: Record<string, any[]> | null = null;
let isLoadingCache = false;

export type ConfigStep = 'idle' | 'selecting_provider' | 'entering_api_key' | 'selecting_model';

export interface UseModelConfigResult {
  step: ConfigStep;
  isActive: boolean;
  pendingModal: ModalState;
  pendingCommand: string | null;
  isLoading: boolean;  // 是否正在加载模型列表
  startConfig: (pendingCommand?: string) => void;
  cancelConfig: () => void;
  onKeyUp: () => void;
  onKeyDown: () => void;
  onKeyReturn: (input: string) => void;
  onApiKeyInput: (key: { backspace?: boolean; delete?: boolean }, input: string) => void;
  onApiKeySubmit: () => void;
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
  const ALLOWED_PROVIDERS = ['zai', 'minimax-cn'];
  providersCache = gp().filter((p: string) => ALLOWED_PROVIDERS.includes(p));
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
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [configTriggered, setConfigTriggered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startConfig = useCallback((cmd?: string) => {
    setPendingCommand(cmd || null);
    setStep('selecting_provider');
    setConfigTriggered(true);
    setIsLoading(true);
    // 触发异步加载
    ensureProvidersLoaded().then(() => {
      setIsLoading(false);
    });
  }, []);

  const cancelConfig = useCallback(() => {
    setStep('idle');
    setSelectedProvider(null);
    setSelectedModelIndex(0);
    setApiKeyInput('');
    setPendingCommand(null);
    setConfigTriggered(false);
  }, []);

  const pendingModal = useMemo((): ModalState => {
    if (isLoading) {
      return { kind: 'none' };
    }
    if (step === 'idle' || !configTriggered) {
      return { kind: 'none' };
    }

    const providers = getProviders();
    if (!providers) {
      return { kind: 'none' };
    }

    if (step === 'selecting_provider') {
      return {
        kind: 'selectOne',
        message: 'Select Provider',
        choices: providers.map(p => {
          const configured = checkApiKeyConfigured(p);
          const status = configured ? '[* configured]' : '[ ] not configured';
          return `${p.toUpperCase().padEnd(15)} ${status}`;
        }),
        selected: selectedModelIndex,
      };
    }

    if (step === 'entering_api_key') {
      return {
        kind: 'ask',
        message: `API Key for ${selectedProvider?.toUpperCase()}: ${apiKeyInput}`,
        value: apiKeyInput,
      };
    }

    if (step === 'selecting_model') {
      const models = getModels(selectedProvider!) || [];
      return {
        kind: 'selectOne',
        message: `Select Model (${selectedProvider?.toUpperCase()})`,
        choices: models.map((m: any) => m.id),
        selected: selectedModelIndex,
      };
    }

    return { kind: 'none' };
  }, [step, selectedProvider, selectedModelIndex, apiKeyInput, configTriggered, isLoading]);

  const onKeyUp = useCallback(() => {
    const providers = getProviders();
    if (step === 'selecting_provider' && providers) {
      setSelectedModelIndex(prev => Math.max(0, prev - 1));
    } else if (step === 'selecting_model') {
      setSelectedModelIndex(prev => Math.max(0, prev - 1));
    }
  }, [step]);

  const onKeyDown = useCallback(() => {
    const providers = getProviders();
    if (step === 'selecting_provider' && providers) {
      setSelectedModelIndex(prev => Math.min(providers.length - 1, prev + 1));
    } else if (step === 'selecting_model') {
      const models = getModels(selectedProvider!) || [];
      setSelectedModelIndex(prev => Math.min(models.length - 1, prev + 1));
    }
  }, [step, selectedProvider]);

  const onKeyReturn = useCallback((input: string) => {
    const providers = getProviders();
    if (step === 'selecting_provider' && providers) {
      const provider = providers[selectedModelIndex];
      if (!provider) return;

      setSelectedProvider(provider);

      if (!checkApiKeyConfigured(provider)) {
        setApiKeyInput('');
        setStep('entering_api_key');
      } else {
        const models = getModels(provider);
        if (models && models.length > 0) {
          setSelectedModelIndex(0);
          setStep('selecting_model');
        } else {
          cancelConfig();
        }
      }
      return;
    }

    if (step === 'selecting_model') {
      const provider = selectedProvider;
      if (!provider) return;

      const models = getModels(provider);
      if (!models) return;

      const selectedModel = models[selectedModelIndex];
      if (selectedModel) {
        agent.setModel(selectedModel as any);
        saveModelConfig(selectedModel.provider, selectedModel.id);

        const cmd = pendingCommand;
        cancelConfig();

        if (cmd) {
          setPendingCommand(cmd);
        }
      }
    }
  }, [step, selectedProvider, selectedModelIndex, agent, pendingCommand, cancelConfig]);

  const onApiKeyInput = useCallback((key: { backspace?: boolean; delete?: boolean }, input: string) => {
    if (key.backspace || key.delete) {
      setApiKeyInput(prev => prev.slice(0, -1));
      return;
    }
    if (input) {
      setApiKeyInput(prev => prev + input);
    }
  }, []);

  const onApiKeySubmit = useCallback(() => {
    if (apiKeyInput.length > 0 && selectedProvider) {
      saveApiKey(selectedProvider, apiKeyInput);
      const models = getModels(selectedProvider);
      if (models && models.length > 0) {
        setSelectedModelIndex(0);
        setStep('selecting_model');
      } else {
        cancelConfig();
      }
    }
  }, [apiKeyInput, selectedProvider, cancelConfig]);

  return {
    step,
    isActive: step !== 'idle',
    pendingModal,
    pendingCommand,
    isLoading,
    startConfig,
    cancelConfig,
    onKeyUp,
    onKeyDown,
    onKeyReturn,
    onApiKeyInput,
    onApiKeySubmit,
  };
}
