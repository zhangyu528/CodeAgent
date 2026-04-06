import { useStdout } from 'ink';
import { DEFAULT_MODAL_WIDTH } from './ModalFrame.js';
import { useModalStore } from './modalStore.js';
import { useInput } from 'ink';

export interface ModalContainerViewProps {
  modal: ReturnType<typeof useModalStore.getState>['modal'];
  width: number;
}

export function useModalController() {
  const modal = useModalStore(state => state.modal);
  const close = useModalStore(state => state.close);
  const moveSelection = useModalStore(state => state.moveSelection);
  const togglePicked = useModalStore(state => state.togglePicked);
  const appendInput = useModalStore(state => state.appendInput);
  const backspaceInput = useModalStore(state => state.backspaceInput);
  const submit = useModalStore(state => state.submit);
  const { stdout } = useStdout();

  useInput((input, key) => {
    if (modal.kind === 'none') return;

    if (key.escape) {
      close();
      return;
    }

    if (modal.kind === 'notice' || modal.kind === 'confirm') {
      if (key.return) submit();
      return;
    }

    if (modal.kind === 'ask') {
      if (key.return) {
        submit();
        return;
      }
      if (key.backspace || key.delete) {
        backspaceInput();
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        appendInput(input);
      }
      return;
    }

    if (modal.kind === 'selectOne' || modal.kind === 'selectMany') {
      if (key.upArrow) {
        moveSelection(-1);
        return;
      }
      if (key.downArrow) {
        moveSelection(1);
        return;
      }
      if (modal.kind === 'selectMany' && input === ' ') {
        togglePicked();
        return;
      }
      if (key.return || key.tab) {
        submit();
      }
    }
  }, { isActive: modal.kind !== 'none' });

  return {
    modal,
    width: Math.max(36, Math.min(DEFAULT_MODAL_WIDTH, stdout.columns - 6)),
  } satisfies ModalContainerViewProps;
}
