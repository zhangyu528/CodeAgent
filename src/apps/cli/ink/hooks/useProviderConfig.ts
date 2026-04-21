/**
 * Provider Configuration Hook
 * UI layer for provider/model selection and API key input.
 * Core logic is in src/core/modelRegistry.ts
 */

import {
  ensureProvidersLoaded,
  getProviders,
  getModels,
  checkApiKeyConfigured,
} from '@codeagent/core';
import { showNotice, showSelectOne, showAsk } from '../components/modals/index.js';

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
  models: any[],
  onSelect: (model: any) => void,
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
