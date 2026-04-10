/**
 * Shared visibility state for all modals
 * This avoids circular import issues during module initialization
 */
import { useAppStore } from '../../store/uiStore.js';

export const modalVisibility = {
  notice: false,
  confirm: false,
  ask: false,
  selectOne: false,
};

function updateStoreVisibility() {
  const isOpen = modalVisibility.notice || modalVisibility.confirm || modalVisibility.ask || modalVisibility.selectOne;
  useAppStore.getState().setHasModalOpen(isOpen);
}

export function setModalVisibility(key: keyof typeof modalVisibility, value: boolean) {
  modalVisibility[key] = value;
  updateStoreVisibility();
}

// FIXED: Return a React hook that returns the current modal open state
export function useModalOpenState() {
  return useAppStore(state => state.hasModalOpen);
}

// Keep the old function for backwards compatibility (but prefer the hook)
export function hasAnyModalOpen(): boolean {
  return useAppStore.getState().hasModalOpen;
}
