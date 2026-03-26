import { ChoicePrompt } from '../components/overlays/types.js';

export type LineItem = { id: string; text: string; isAssistant?: boolean };

export type PiPage = 'welcome' | 'chat';

export interface PiAppState {
  dimensions: { columns: number; rows: number };
  page: PiPage;
  inputValue: string;
  lines: LineItem[];
  thinking: boolean;
  prompt: ChoicePrompt;
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
  | { type: 'COMMAND_EXEC'; op: 'show_prompt'; prompt: ChoicePrompt }
  | { type: 'COMMAND_EXEC'; op: 'hide_prompt' }
  | { type: 'COMMAND_EXEC'; op: 'show_history' }
  | { type: 'COMMAND_EXEC'; op: 'hide_history' }
  | { type: 'COMMAND_EXEC'; op: 'append_user_line'; text: string }
  | { type: 'COMMAND_EXEC'; op: 'append_system_line'; text: string };

type SessionRestoredAction = {
  type: 'SESSION_RESTORED';
  lines: LineItem[];
};

type AgentEventAction =
  | { type: 'AGENT_EVENT'; op: 'agent_start' }
  | { type: 'AGENT_EVENT'; op: 'agent_end' }
  | { type: 'AGENT_EVENT'; op: 'text_delta'; delta: string }
  | { type: 'AGENT_EVENT'; op: 'thinking_delta'; delta: string }
  | { type: 'AGENT_EVENT'; op: 'error'; message: string }
  | { type: 'AGENT_EVENT'; op: 'usage'; usage: { input: number; output: number; cost: number } };

type ModelConfigEventAction =
  | { type: 'MODEL_CONFIG_EVENT'; op: 'sync_prompt'; prompt: ChoicePrompt }
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
    lines: [],
    thinking: false,
    prompt: { kind: 'none' },
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
          return { ...state, lines: [], inputValue: '' };
        case 'goto_welcome':
          return { ...state, page: 'welcome', inputValue: '' };
        case 'goto_chat':
          return { ...state, page: 'chat' };
        case 'show_prompt':
          return { ...state, prompt: action.prompt, inputValue: '' };
        case 'hide_prompt':
          return { ...state, prompt: { kind: 'none' } };
        case 'show_history':
          return { ...state, historyVisible: true, historySelected: 0, inputValue: '' };
        case 'hide_history':
          return { ...state, historyVisible: false };
        case 'append_user_line':
          return {
            ...state,
            page: 'chat',
            lines: [...state.lines, { id: `u-${Date.now()}`, text: action.text }],
            inputValue: '',
          };
        case 'append_system_line':
          return {
            ...state,
            page: 'chat',
            lines: [...state.lines, { id: `sys-${Date.now()}`, text: action.text }],
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
        lines: action.lines,
        inputValue: '',
        thinking: false,
        usage: null,
        historyVisible: false,
        prompt: { kind: 'none' },
        exitPromptVisible: false,
        pendingCommandAfterConfig: null,
      };
    case 'AGENT_EVENT': {
      switch (action.op) {
        case 'agent_start':
          return { ...state, thinking: true, usage: null };
        case 'agent_end':
          return { ...state, thinking: false };
        case 'text_delta': {
          const last = state.lines[state.lines.length - 1];
          if (last && last.isAssistant) {
            return {
              ...state,
              thinking: false,
              lines: [...state.lines.slice(0, -1), { ...last, text: last.text + action.delta }],
            };
          }
          return {
            ...state,
            thinking: false,
            lines: [...state.lines, { id: `ai-${Date.now()}`, text: action.delta, isAssistant: true }],
          };
        }
        case 'thinking_delta': {
          const last = state.lines[state.lines.length - 1];
          if (last && last.id.startsWith('thinking-')) {
            return {
              ...state,
              thinking: true,
              lines: [...state.lines.slice(0, -1), { ...last, text: last.text + action.delta }],
            };
          }
          return {
            ...state,
            thinking: true,
            lines: [...state.lines, { id: `thinking-${Date.now()}`, text: `[Thinking] ${action.delta}` }],
          };
        }
        case 'error':
          return {
            ...state,
            lines: [...state.lines, { id: `error-${Date.now()}`, text: `[Error] ${action.message}`, isAssistant: true }],
          };
        case 'usage':
          return { ...state, usage: action.usage };
        default:
          return state;
      }
    }
    case 'MODEL_CONFIG_EVENT':
      if (action.op === 'sync_prompt') {
        return { ...state, prompt: action.prompt };
      }
      return { ...state, pendingCommandAfterConfig: action.command };
    case 'EXIT_CONFIRM_EVENT':
      return { ...state, exitPromptVisible: action.op === 'show' };
    default:
      return state;
  }
}




