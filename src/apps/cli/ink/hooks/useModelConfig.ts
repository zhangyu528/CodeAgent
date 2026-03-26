import { useState, useCallback, useMemo } from 'react';
import { Agent } from '@mariozechner/pi-agent-core';
import { getModels, getProviders } from '@mariozechner/pi-ai';
import { checkApiKeyConfigured, saveApiKey, saveModelConfig } from '../../../../core/pi/factory.js';
import { ChoicePrompt } from '../components/types.js';

const ALLOWED_PROVIDERS = ['zai', 'minimax-cn'];
const PROVIDERS = getProviders().filter(p => ALLOWED_PROVIDERS.includes(p));

const MODELS_BY_PROVIDER: Record<string, ReturnType<typeof getModels>> = {};
for (const p of PROVIDERS) {
  MODELS_BY_PROVIDER[p] = getModels(p);
}

export type ConfigStep = 'idle' | 'selecting_provider' | 'entering_api_key' | 'selecting_model';

export interface UseModelConfigResult {
  step: ConfigStep;
  isActive: boolean;
  pendingPrompt: ChoicePrompt;
  pendingCommand: string | null;
  startConfig: (pendingCommand?: string) => void;
  cancelConfig: () => void;
  onKeyUp: () => void;
  onKeyDown: () => void;
  onKeyReturn: (input: string) => void;
  onApiKeyInput: (key: { backspace?: boolean; delete?: boolean }, input: string) => void;
  onApiKeySubmit: () => void;
}

export function useModelConfig(agent: Agent): UseModelConfigResult {
  const [step, setStep] = useState<ConfigStep>('idle');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [configTriggered, setConfigTriggered] = useState(false);

  const startConfig = useCallback((cmd?: string) => {
    setPendingCommand(cmd || null);
    setStep('selecting_provider');
    setConfigTriggered(true);
  }, []);

  const cancelConfig = useCallback(() => {
    setStep('idle');
    setSelectedProvider(null);
    setSelectedModelIndex(0);
    setApiKeyInput('');
    setPendingCommand(null);
    setConfigTriggered(false);
  }, []);

  // Generate prompt for current step (used by PromptOverlay)
  const pendingPrompt = useMemo((): ChoicePrompt => {
    if (step === 'idle' || !configTriggered) {
      return { kind: 'none' };
    }
    
    if (step === 'selecting_provider') {
      return {
        kind: 'selectOne',
        message: 'Select Provider',
        choices: PROVIDERS.map(p => {
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
      const models = MODELS_BY_PROVIDER[selectedProvider!] || [];
      return {
        kind: 'selectOne',
        message: `Select Model (${selectedProvider?.toUpperCase()})`,
        choices: models.map((m: any) => m.id),
        selected: selectedModelIndex,
      };
    }
    
    return { kind: 'none' };
  }, [step, selectedProvider, selectedModelIndex, apiKeyInput, configTriggered]);

  const onKeyUp = useCallback(() => {
    if (step === 'selecting_provider') {
      setSelectedModelIndex(prev => Math.max(0, prev - 1));
    } else if (step === 'selecting_model') {
      const models = MODELS_BY_PROVIDER[selectedProvider!] || [];
      setSelectedModelIndex(prev => Math.max(0, prev - 1));
    }
  }, [step, selectedProvider]);

  const onKeyDown = useCallback(() => {
    if (step === 'selecting_provider') {
      setSelectedModelIndex(prev => Math.min(PROVIDERS.length - 1, prev + 1));
    } else if (step === 'selecting_model') {
      const models = MODELS_BY_PROVIDER[selectedProvider!] || [];
      setSelectedModelIndex(prev => Math.min(models.length - 1, prev + 1));
    }
  }, [step, selectedProvider]);

  const onKeyReturn = useCallback((input: string) => {
    if (step === 'selecting_provider') {
      const provider = PROVIDERS[selectedModelIndex];
      if (!provider) return;
      
      setSelectedProvider(provider);
      
      if (!checkApiKeyConfigured(provider)) {
        setApiKeyInput('');
        setStep('entering_api_key');
      } else {
        const models = MODELS_BY_PROVIDER[provider];
        if (models && models.length > 0) {
          setSelectedModelIndex(0);
          setStep('selecting_model');
        } else {
          // No models, configuration complete
          cancelConfig();
        }
      }
      return;
    }
    
    if (step === 'selecting_model') {
      const provider = selectedProvider;
      if (!provider) return;
      
      const models = MODELS_BY_PROVIDER[provider];
      if (!models) return;
      
      const selectedModel = models[selectedModelIndex];
      if (selectedModel) {
        // Apply the full model descriptor from pi-ai.
        // Downstream runtime expects fields like input/compat/cost/contextWindow.
        agent.setModel(selectedModel as any);
        
        // Save to .env for persistence
        saveModelConfig(selectedModel.provider, selectedModel.id);
        
        // Execute pending command if any
        const cmd = pendingCommand;
        cancelConfig();
        
        if (cmd) {
          // Return the pending command so pi_app can execute it
          setPendingCommand(cmd);
        }
      }
      return;
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
      const models = MODELS_BY_PROVIDER[selectedProvider];
      if (models && models.length > 0) {
        setSelectedModelIndex(0);
        setStep('selecting_model');
      } else {
        // No models available, configuration complete
        cancelConfig();
      }
    }
  }, [apiKeyInput, selectedProvider, cancelConfig]);

  return {
    step,
    isActive: step !== 'idle',
    pendingPrompt,
    pendingCommand,
    startConfig,
    cancelConfig,
    onKeyUp,
    onKeyDown,
    onKeyReturn,
    onApiKeyInput,
    onApiKeySubmit,
  };
}
