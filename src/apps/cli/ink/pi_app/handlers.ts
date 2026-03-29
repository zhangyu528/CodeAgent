import { FocusOwner } from './utils.js';
import { SessionInfo } from '../../../../core/pi/sessions.js';

export interface HandlerContext {
  state: any;
  dispatch: any;
  modelConfig: any;
  historyItems: SessionInfo[];
  currentSession: any;
  agent: any;
  isSlashVisible: boolean;
  filteredCommands: any[];
  focusOwner: FocusOwner;
  onExit: () => void;
  exit: () => void;
  restoreSessionById: (sessionId: string) => Promise<boolean>;
  showRestoreFailureModal: (message: string) => void;
  setIsDebugVisible: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export function handleExitKey(ctx: HandlerContext, input: string, key: { ctrl?: boolean }): boolean {
  const isExitKey =
    (key.ctrl && (input === 'c' || input === 'd')) ||
    input === '\u0003' ||
    input === '\u0004';

  if (!isExitKey) return false;

  if (ctx.state.exitPromptVisible) {
    ctx.onExit();
    ctx.exit();
    return true;
  }

  // Trigger exit prompt
  ctx.dispatch({ type: 'EXIT_CONFIRM_EVENT', op: 'show' });
  setTimeout(() => {
    ctx.dispatch({ type: 'EXIT_CONFIRM_EVENT', op: 'hide' });
  }, 3000);
  return true;
}

export function handleEscapeKey(ctx: HandlerContext, key: { escape?: boolean }): boolean {
  if (!key.escape) return false;

  if (ctx.focusOwner === 'exitConfirm') {
    ctx.dispatch({ type: 'EXIT_CONFIRM_EVENT', op: 'hide' });
    return true;
  }

  if (ctx.focusOwner === 'modelConfig') {
    ctx.modelConfig.cancelConfig();
    ctx.dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
    return true;
  }

  if (ctx.focusOwner === 'modal') {
    ctx.dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
    return true;
  }

  return false;
}

export function handleModelConfigInput(ctx: HandlerContext, input: string, key: any): boolean {
  if (!ctx.modelConfig.isActive) return false;

  if (ctx.modelConfig.step === 'entering_api_key') {
    if (key.return) {
      ctx.modelConfig.onApiKeySubmit();
      return true;
    }
    ctx.modelConfig.onApiKeyInput(key, input);
    return true;
  }

  if (key.upArrow) {
    ctx.modelConfig.onKeyUp();
    return true;
  }

  if (key.downArrow) {
    ctx.modelConfig.onKeyDown();
    return true;
  }

  if (key.return) {
    ctx.modelConfig.onKeyReturn(input);
    return true;
  }

  return true;
}

export function handleModalInput(ctx: HandlerContext, key: any): boolean {
  if (ctx.state.modal.kind === 'none') return false;

  if (ctx.state.modal.kind === 'selectOne') {
    if (key.upArrow) {
      ctx.dispatch({
        type: 'COMMAND_EXEC',
        op: 'show_modal',
        modal: { ...ctx.state.modal, selected: Math.max(0, ctx.state.modal.selected - 1) },
      });
      return true;
    }

    if (key.downArrow) {
      ctx.dispatch({
        type: 'COMMAND_EXEC',
        op: 'show_modal',
        modal: { ...ctx.state.modal, selected: Math.min(ctx.state.modal.choices.length - 1, ctx.state.modal.selected + 1) },
      });
      return true;
    }

    if (key.return) {
      if ((ctx.state.modal.message || '').includes('Sessions')) {
        const sessionInfo = ctx.historyItems[ctx.state.modal.selected];
        if (sessionInfo) {
          void ctx.restoreSessionById(sessionInfo.id);
        } else {
          ctx.showRestoreFailureModal('Failed to restore session. The selected session is no longer available.');
        }
      }
      ctx.dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
      return true;
    }
  }

  if ((ctx.state.modal.kind === 'ask' || ctx.state.modal.kind === 'confirm') && key.return) {
    ctx.dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
    return true;
  }

  return true;
}

export function handleSlashInput(ctx: HandlerContext, key: any): boolean {
  if (!ctx.isSlashVisible) return false;

  if (key.upArrow) {
    ctx.dispatch({ type: 'INPUT_KEY', op: 'slash_up' });
    return true;
  }

  if (key.downArrow) {
    ctx.dispatch({ type: 'INPUT_KEY', op: 'slash_down', max: ctx.filteredCommands.length - 1 });
    return true;
  }

  const selected = ctx.filteredCommands[ctx.state.slashSelected];
  if (key.tab && selected) {
    ctx.dispatch({ type: 'INPUT_KEY', op: 'set_value', value: selected.name });
    return true;
  }

  if (key.return && selected) {
    return true; // Command execution is handled by parent
  }

  return false;
}

export function handleRegularInput(ctx: HandlerContext, input: string, key: any): boolean {
  if (key.return) {
    return true; // Command execution is handled by parent
  }

  if (key.backspace || key.delete) {
    ctx.dispatch({ type: 'INPUT_KEY', op: 'backspace' });
    return true;
  }

  if (!key.ctrl && !key.meta && input) {
    ctx.dispatch({ type: 'INPUT_KEY', op: 'append_value', value: input });
    return true;
  }

  return false;
}
