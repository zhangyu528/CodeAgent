import { useState, useCallback, useEffect, useMemo } from 'react';
import type { AgentSession } from '@codeagent/core';
import { saveApiKey } from '@codeagent/core';
import { showNotice } from '../components/modals/index.js';
import { useAppStore } from '../store/uiStore.js';
import {
  ensureProvidersLoaded,
  getProviders,
  getModels,
  checkApiKeyConfigured,
} from '@codeagent/core';
import { showProviderSelection, showModelSelection, showApiKeyInput } from './useProviderConfig.js';

export type ConfigStep = 'idle' | 'selecting_provider' | 'entering_api_key' | 'selecting_model';

export interface UseModelConfigResult {
  step: ConfigStep;
  isActive: boolean;
  pendingCommand: string | null;
  isLoading: boolean;
  startConfig: (pendingCommand?: string) => void;
  cancelConfig: () => void;
}

export function useModelConfig(session: AgentSession): UseModelConfigResult {
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
    ensureProvidersLoaded()
      .then(() => {
        setIsLoading(false);
      })
      .catch(error => {
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
      showNotice({
        title: 'Model Configuration',
        message: 'Loading available providers and models...',
        footer: 'Esc Cancel',
      });
      return;
    }

    if (loadError) {
      showNotice({
        title: 'Model Configuration',
        message: `Failed to load providers.\n${loadError}`,
        footer: 'Esc Close',
      });
      return;
    }

    const cachedProviders = providers;
    if (!cachedProviders || step === 'idle') return;

    if (step === 'selecting_provider') {
      showProviderSelection(
        cachedProviders,
        provider => {
          if (!checkApiKeyConfigured(provider)) {
            setSelectedProvider(provider);
            setStep('entering_api_key');
            return;
          }

          const models = getModels(provider);
          if (!models || models.length === 0) {
            showNotice({
              title: 'Model Configuration',
              message: `No models available for ${provider.toUpperCase()}.`,
              footer: 'Esc Close',
            });
            return;
          }

          showModelSelection(
            provider,
            models,
            selectedModel => {
              try {
                cancelConfig();
                setCurrentModel(selectedModel.id);
              } catch (error) {
                showNotice({
                  title: 'Model Configuration',
                  message: `Failed to set model:\n${error instanceof Error ? error.message : String(error)}\n\nPress Esc to close.`,
                  footer: 'Esc Close',
                });
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
        apiKey => {
          if (!saveApiKey(selectedProvider, apiKey)) {
            showNotice({
              title: 'Model Configuration',
              message: `Invalid API key for ${selectedProvider.toUpperCase()}.`,
              footer: 'Esc Close',
            });
            return;
          }
          const models = getModels(selectedProvider);
          if (!models || models.length === 0) {
            showNotice({
              title: 'Model Configuration',
              message: `No models available for ${selectedProvider.toUpperCase()}.`,
              footer: 'Esc Close',
            });
            return;
          }

          showModelSelection(
            selectedProvider,
            models,
            selectedModel => {
              try {
                void session.setModel(selectedModel as any);
                setCurrentModel(selectedModel.id);
              } catch (error) {
                showNotice({
                  title: 'Model Configuration',
                  message: `Failed to set model: ${error instanceof Error ? error.message : String(error)}`,
                  footer: 'Esc Close',
                });
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
        selectedModel => {
          try {
            void session.setModel(selectedModel as any);
            setCurrentModel(selectedModel.id);
          } catch (error) {
            showNotice({
              title: 'Model Configuration',
              message: `Failed to set model:\n${error instanceof Error ? error.message : String(error)}\n\nPress Esc to close.`,
              footer: 'Esc Close',
            });
            cancelConfig();
          }
        },
        cancelConfig
      );
    }
  }, [
    session,
    cancelConfig,
    configTriggered,
    isLoading,
    loadError,
    selectedProvider,
    providers,
    setCurrentModel,
    step,
  ]);

  return {
    step,
    isActive: step !== 'idle',
    pendingCommand,
    isLoading,
    startConfig,
    cancelConfig,
  };
}
