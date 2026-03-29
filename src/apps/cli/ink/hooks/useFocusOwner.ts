import type { ModalState } from '../components/overlays/types.js';

export type FocusOwner = 'mainInput' | 'slash' | 'modal' | 'modelConfig' | 'exitConfirm';

interface UseFocusOwnerOptions {
  exitPromptVisible: boolean;
  isModelConfigActive: boolean;
  modal: ModalState;
  isSlashVisible: boolean;
}

export function useFocusOwner(options: UseFocusOwnerOptions): FocusOwner {
  const { exitPromptVisible, isModelConfigActive, modal, isSlashVisible } = options;
  const hasModal = modal.kind !== 'none';

  if (exitPromptVisible) return 'exitConfirm';
  if (isModelConfigActive) return 'modelConfig';
  if (hasModal) return 'modal';
  if (isSlashVisible) return 'slash';
  return 'mainInput';
}
