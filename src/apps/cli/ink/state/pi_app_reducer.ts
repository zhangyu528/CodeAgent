import { ModalState } from '../components/overlays/types.js';
import { ChatMessage } from '../components/pages/types.js';

export type PiPage = 'welcome' | 'chat';

export interface PiAppState {
  dimensions: { columns: number; rows: number };
  page: PiPage;
  inputValue: string;
  messages: ChatMessage[];
  thinking: boolean;
  modal: ModalState;
  usage: { input: number; output: number; cost: number } | null;
  slashSelected: number;
  historyVisible: boolean;
  historySelected: number;
  exitPromptVisible: boolean;
  pendingCommandAfterConfig: string | null;
}

type InputKeyAction =
  | { type: 'INPUT_KEY'; op: 'set_value'; value: string }
  | { type: 'INPUT_KEY'; op: 'append_value'; value: string }
  | { type: 'INPUT_KEY'; op: 'backspace' }
  | { type: 'INPUT_KEY'; op: 'clear_value' }
  | { type: 'INPUT_KEY'; op: 'slash_up' }
  | { type: 'INPUT_KEY'; op: 'slash_down'; max: number }
  | { type: 'INPUT_KEY'; op: 'history_up' }
  | { type: 'INPUT_KEY'; op: 'history_down'; max: number };

type CommandExecAction =
  | { type: 'COMMAND_EXEC'; op: 'clear' }
  | { type: 'COMMAND_EXEC'; op: 'goto_welcome' }
  | { type: 'COMMAND_EXEC'; op: 'goto_chat' }
  | { type: 'COMMAND_EXEC'; op: 'show_modal'; modal: ModalState }
  | { type: 'COMMAND_EXEC'; op: 'hide_modal' }
  | { type: 'COMMAND_EXEC'; op: 'show_history' }
  | { type: 'COMMAND_EXEC'; op: 'hide_history' }
  | { type: 'COMMAND_EXEC'; op: 'append_user_message'; text: string }
  | { type: 'COMMAND_EXEC'; op: 'append_system_message'; text: string }
  | { type: 'COMMAND_EXEC'; op: 'append_error_message'; text: string };

type SessionRestoredAction = {
  type: 'SESSION_RESTORED';
  messages: ChatMessage[];
};

type AgentEventAction =
  | { type: 'AGENT_EVENT'; op: 'agent_start' }
  | { type: 'AGENT_EVENT'; op: 'agent_end' }
  | { type: 'AGENT_EVENT'; op: 'text_delta'; delta: string }
  | { type: 'AGENT_EVENT'; op: 'thinking_delta'; delta: string }
  | { type: 'AGENT_EVENT'; op: 'error'; message: string }
  | { type: 'AGENT_EVENT'; op: 'usage'; usage: { input: number; output: number; cost: number } };

type ModelConfigEventAction =
  | { type: 'MODEL_CONFIG_EVENT'; op: 'sync_modal'; modal: ModalState }
  | { type: 'MODEL_CONFIG_EVENT'; op: 'remember_pending_command'; command: string };

type ExitConfirmEventAction =
  | { type: 'EXIT_CONFIRM_EVENT'; op: 'show' }
  | { type: 'EXIT_CONFIRM_EVENT'; op: 'hide' };

type UiAction = { type: 'UI_EVENT'; op: 'set_dimensions'; columns: number; rows: number };

export type PiAppAction =
  | InputKeyAction
  | CommandExecAction
  | SessionRestoredAction
  | AgentEventAction
  | ModelConfigEventAction
  | ExitConfirmEventAction
  | UiAction;

export function createInitialState(columns: number, rows: number): PiAppState {
  return {
    dimensions: { columns, rows },
    page: 'welcome',
    inputValue: '',
    messages: [],
    thinking: false,
    modal: { kind: 'none' },
    usage: null,
    slashSelected: 0,
    historyVisible: false,
    historySelected: 0,
    exitPromptVisible: false,
    pendingCommandAfterConfig: null,
  };
}

export function piAppReducer(state: PiAppState, action: PiAppAction): PiAppState {
  switch (action.type) {
    case 'UI_EVENT':
      return {
        ...state,
        dimensions: { columns: action.columns, rows: action.rows },
      };
    case 'INPUT_KEY': {
      switch (action.op) {
        case 'set_value':
          return { ...state, inputValue: action.value, slashSelected: 0 };
        case 'append_value':
          return { ...state, inputValue: state.inputValue + action.value, slashSelected: 0 };
        case 'backspace':
          return { ...state, inputValue: state.inputValue.slice(0, -1), slashSelected: 0 };
        case 'clear_value':
          return { ...state, inputValue: '', slashSelected: 0 };
        case 'slash_up':
          return { ...state, slashSelected: Math.max(0, state.slashSelected - 1) };
        case 'slash_down':
          return { ...state, slashSelected: Math.min(Math.max(0, action.max), state.slashSelected + 1) };
        case 'history_up':
          return { ...state, historySelected: Math.max(0, state.historySelected - 1) };
        case 'history_down':
          return { ...state, historySelected: Math.min(Math.max(0, action.max), state.historySelected + 1) };
        default:
          return state;
      }
    }
    case 'COMMAND_EXEC': {
      switch (action.op) {
        case 'clear':
          return { ...state, messages: [], inputValue: '' };
        case 'goto_welcome':
          return { ...state, page: 'welcome', inputValue: '' };
        case 'goto_chat':
          return { ...state, page: 'chat' };
        case 'show_modal':
          return { ...state, modal: action.modal, inputValue: '' };
        case 'hide_modal':
          return { ...state, modal: { kind: 'none' } };
        case 'show_history':
          return { ...state, historyVisible: true, historySelected: 0, inputValue: '' };
        case 'hide_history':
          return { ...state, historyVisible: false };
        case 'append_user_message':
          return {
            ...state,
            page: 'chat',
            messages: [
              ...state.messages,
              {
                id: `u-${Date.now()}`,
                role: 'user',
                title: 'You',
                createdAt: Date.now(),
                status: 'completed',
                blocks: [{ kind: 'text', text: action.text }],
              },
            ],
            inputValue: '',
          };
        case 'append_system_message':
          return {
            ...state,
            page: 'chat',
            messages: [
              ...state.messages,
              {
                id: `sys-${Date.now()}`,
                role: 'system',
                title: 'System',
                createdAt: Date.now(),
                status: 'completed',
                blocks: [{ kind: 'text', text: action.text }],
              },
            ],
            inputValue: '',
          };
        case 'append_error_message':
          return {
            ...state,
            page: 'chat',
            messages: [
              ...state.messages,
              {
                id: `error-${Date.now()}`,
                role: 'error',
                title: 'Error',
                createdAt: Date.now(),
                status: 'error',
                blocks: [{ kind: 'text', text: action.text }],
              },
            ],
            inputValue: '',
          };
        default:
          return state;
      }
    }
    case 'SESSION_RESTORED':
      return {
        ...state,
        page: 'chat',
        messages: action.messages,
        inputValue: '',
        thinking: false,
        usage: null,
        historyVisible: false,
        modal: { kind: 'none' },
        exitPromptVisible: false,
        pendingCommandAfterConfig: null,
      };
    case 'AGENT_EVENT': {
      switch (action.op) {
        case 'agent_start':
          return { ...state, thinking: true, usage: null };
        case 'agent_end': {
          const last = state.messages[state.messages.length - 1];
          if (last && last.role === 'assistant') {
            return {
              ...state,
              thinking: false,
              messages: [
                ...state.messages.slice(0, -1),
                { ...last, status: 'completed' },
              ],
            };
          }
          return { ...state, thinking: false };
        }
        case 'text_delta': {
          const last = state.messages[state.messages.length - 1];
          if (last && last.role === 'assistant') {
            const blockIndex = last.blocks.findIndex(block => block.kind === 'text');
            if (blockIndex >= 0) {
            const nextBlocks = [...last.blocks];
            const textBlock = nextBlocks[blockIndex];
            if (!textBlock || textBlock.kind !== 'text') {
              return {
                ...state,
                thinking: false,
                messages: [
                  ...state.messages.slice(0, -1),
                  { ...last, status: 'streaming', blocks: [...last.blocks, { kind: 'text', text: action.delta }] },
                ],
              };
            }
            nextBlocks[blockIndex] = { kind: 'text', text: textBlock.text + action.delta };
              return {
                ...state,
                thinking: false,
                messages: [
                  ...state.messages.slice(0, -1),
                  { ...last, status: 'streaming', blocks: nextBlocks },
                ],
              };
            }
            return {
              ...state,
              thinking: false,
              messages: [
                ...state.messages.slice(0, -1),
                { ...last, status: 'streaming', blocks: [...last.blocks, { kind: 'text', text: action.delta }] },
              ],
            };
          }
          return {
            ...state,
            thinking: false,
            messages: [
              ...state.messages,
              {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                title: 'Assistant',
                createdAt: Date.now(),
                status: 'streaming',
                blocks: [{ kind: 'text', text: action.delta }],
              },
            ],
          };
        }
        case 'thinking_delta': {
          const last = state.messages[state.messages.length - 1];
          if (last && last.role === 'assistant') {
            const blockIndex = last.blocks.findIndex(block => block.kind === 'thinking');
            if (blockIndex >= 0) {
            const nextBlocks = [...last.blocks];
            const thinkingBlock = nextBlocks[blockIndex];
            if (!thinkingBlock || thinkingBlock.kind !== 'thinking') {
              return {
                ...state,
                thinking: true,
                messages: [
                  ...state.messages.slice(0, -1),
                  {
                    ...last,
                    status: 'streaming',
                    blocks: [{ kind: 'thinking', text: action.delta, collapsed: true }, ...last.blocks],
                  },
                ],
              };
            }
            nextBlocks[blockIndex] = {
              kind: 'thinking',
                text: thinkingBlock.text + action.delta,
                collapsed: true,
              };
              return {
                ...state,
                thinking: true,
                messages: [
                  ...state.messages.slice(0, -1),
                  { ...last, status: 'streaming', blocks: nextBlocks },
                ],
              };
            }
            return {
              ...state,
              thinking: true,
              messages: [
                ...state.messages.slice(0, -1),
                {
                  ...last,
                  status: 'streaming',
                  blocks: [{ kind: 'thinking', text: action.delta, collapsed: true }, ...last.blocks],
                },
              ],
            };
          }
          return {
            ...state,
            thinking: true,
            messages: [
              ...state.messages,
              {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                title: 'Assistant',
                createdAt: Date.now(),
                status: 'streaming',
                blocks: [{ kind: 'thinking', text: action.delta, collapsed: true }],
              },
            ],
          };
        }
        case 'error':
          return {
            ...state,
            messages: [
              ...state.messages,
              {
                id: `error-${Date.now()}`,
                role: 'error',
                title: 'Error',
                createdAt: Date.now(),
                status: 'error',
                blocks: [{ kind: 'text', text: action.message }],
              },
            ],
          };
        case 'usage':
          return { ...state, usage: action.usage };
        default:
          return state;
      }
    }
    case 'MODEL_CONFIG_EVENT':
      if (action.op === 'sync_modal') {
        return { ...state, modal: action.modal };
      }
      return { ...state, pendingCommandAfterConfig: action.command };
    case 'EXIT_CONFIRM_EVENT':
      return { ...state, exitPromptVisible: action.op === 'show' };
    default:
      return state;
  }
}
