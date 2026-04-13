import { useState, useCallback, useEffect, useMemo } from 'react';
import { Agent } from '@mariozechner/pi-agent-core';
import { saveApiKey, saveModelConfig } from '../../../../agent/index.js';
import { showNotice } from '../components/modals/index.js';
import { useAppStore } from '../store/uiStore.js';
import {
  ensureProvidersLoaded,
  getProviders,
  getModels,
  checkApiKeyConfigured,
  showProviderSelection,
  showModelSelection,
  showApiKeyInput,
} from './useProviderConfig.js';

export type ConfigStep = 'idle' | 'selecting_provider' | 'entering_api_key' | 'selecting_model';

export interface UseModelConfigResult {
  step: ConfigStep;
  isActive: boolean;
  pendingCommand: string | null;
  isLoading: boolean;  // 是否正在加载模型列表
  startConfig: (pendingCommand?: string) => void;
  cancelConfig: () => void;
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

  const providers = useMemo(() => {
    if (!configTriggered || isLoading || loadError) return null;
    return getProviders();
  }, [configTriggered, isLoading, loadError]);

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

    const cachedProviders = providers;
    if (!cachedProviders || step === 'idle') return;

    if (step === 'selecting_provider') {
      showProviderSelection(
        cachedProviders,
        (provider) => {
          if (!checkApiKeyConfigured(provider)) {
            setSelectedProvider(provider);
            setStep('entering_api_key');
            return;
          }

          // Directly show model selection - no need to wait for useEffect
          const models = getModels(provider);
          if (!models || models.length === 0) {
            showNotice('Model Configuration', `No models available for ${provider.toUpperCase()}.`, 'Esc Close');
            return;
          }

          // Show model selection modal directly
          showModelSelection(
            provider,
            models,
            (selectedModel) => {
              try {
                cancelConfig();
                // Call after cancelConfig so modal is fully closed
                setCurrentModel(selectedModel.id);
              } catch (error) {
                // 显示错误消息在同一个 modal 上
                showNotice(
                  'Model Configuration',
                  `Failed to set model:\n${error instanceof Error ? error.message : String(error)}\n\nPress Esc to close.`,
                  'Esc Close'
                );
              }
            },
            cancelConfig
          );
        },
        cancelConfig
      );
      return;
    }

    if (step === 'entering_api_key' && selectedProvider) {
      showApiKeyInput(
        selectedProvider,
        (apiKey) => {
          saveApiKey(selectedProvider, apiKey);
          const models = getModels(selectedProvider);
          if (!models || models.length === 0) {
            showNotice('Model Configuration', `No models available for ${selectedProvider.toUpperCase()}.`, 'Esc Close');
            return;
          }

          // Show model selection modal directly
          showModelSelection(
            selectedProvider,
            models,
            (selectedModel) => {
              try {
                agent.setModel(selectedModel as any);
                saveModelConfig(selectedProvider, selectedModel.id);
                setCurrentModel(selectedModel.id);
              } catch (error) {
                showNotice('Model Configuration', `Failed to set model: ${error instanceof Error ? error.message : String(error)}`, 'Esc Close');
                return;
              }
              cancelConfig();
            },
            cancelConfig
          );
        },
        cancelConfig
      );
      return;
    }

    if (step === 'selecting_model' && selectedProvider) {
      const models = getModels(selectedProvider) || [];

      showModelSelection(
        selectedProvider,
        models,
        (selectedModel) => {
          try {
            agent.setModel(selectedModel as any);
            saveModelConfig(selectedModel.provider, selectedModel.id);
            setCurrentModel(selectedModel.id);
          } catch (error) {
            showNotice(
              'Model Configuration',
              `Failed to set model:\n${error instanceof Error ? error.message : String(error)}\n\nPress Esc to close.`,
              'Esc Close'
            );
            return;
          }
          cancelConfig();
        },
        cancelConfig
      );
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
