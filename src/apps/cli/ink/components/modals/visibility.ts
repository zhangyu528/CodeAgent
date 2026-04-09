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

export function hasAnyModalOpen(): boolean {
  return modalVisibility.notice || modalVisibility.confirm || modalVisibility.ask || modalVisibility.selectOne;
}
