/**
 * Shared visibility state for all modals
 * This avoids circular import issues during module initialization
 */
export const modalVisibility = {
  notice: false,
  confirm: false,
  ask: false,
  selectOne: false,
};

export function hasAnyModalOpen(): boolean {
  return modalVisibility.notice || modalVisibility.confirm || modalVisibility.ask || modalVisibility.selectOne;
}
