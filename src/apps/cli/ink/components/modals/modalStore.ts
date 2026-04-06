import { create } from 'zustand';

export interface ModalChoice {
  label: string;
  value: string;
}

export type ModalState =
  | { kind: 'none' }
  | { kind: 'notice'; title: string; message: string; footer?: string; onClose?: () => void | Promise<void> }
  | { kind: 'ask'; title: string; message?: string; value: string; footer?: string; onClose?: () => void | Promise<void>; onSubmit?: (value: string) => void | Promise<void> }
  | { kind: 'confirm'; title: string; message: string; footer?: string; onClose?: () => void | Promise<void>; onConfirm?: () => void | Promise<void> }
  | { kind: 'selectOne'; title: string; message?: string; choices: ModalChoice[]; selected: number; footer?: string; emptyLabel?: string; onClose?: () => void | Promise<void>; onSubmit?: (choice: ModalChoice, index: number) => void | Promise<void> }
  | { kind: 'selectMany'; title: string; message?: string; choices: ModalChoice[]; selected: number; picked: Set<number>; footer?: string; emptyLabel?: string; onClose?: () => void | Promise<void>; onSubmit?: (choices: ModalChoice[], indexes: number[]) => void | Promise<void> };

export interface AskModalOptions {
  title: string;
  message?: string;
  value?: string;
  footer?: string;
  onClose?: () => void | Promise<void>;
  onSubmit?: (value: string) => void | Promise<void>;
}

export interface ConfirmModalOptions {
  title: string;
  message: string;
  footer?: string;
  onClose?: () => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
}

export interface SelectOneModalOptions {
  title: string;
  message?: string;
  choices: ModalChoice[];
  selected?: number;
  footer?: string;
  emptyLabel?: string;
  onClose?: () => void | Promise<void>;
  onSubmit?: (choice: ModalChoice, index: number) => void | Promise<void>;
}

export interface SelectManyModalOptions {
  title: string;
  message?: string;
  choices: ModalChoice[];
  selected?: number;
  picked?: Set<number>;
  footer?: string;
  emptyLabel?: string;
  onClose?: () => void | Promise<void>;
  onSubmit?: (choices: ModalChoice[], indexes: number[]) => void | Promise<void>;
}

interface ModalStore {
  modal: ModalState;
  openNotice: (title: string, message: string, footer?: string, onClose?: () => void | Promise<void>) => void;
  openAsk: (options: AskModalOptions) => void;
  openConfirm: (options: ConfirmModalOptions) => void;
  openSelectOne: (options: SelectOneModalOptions) => void;
  openSelectMany: (options: SelectManyModalOptions) => void;
  moveSelection: (delta: number) => void;
  togglePicked: () => void;
  appendInput: (text: string) => void;
  backspaceInput: () => void;
  submit: () => void;
  close: () => void;
}

function runCallback(callback?: ((...args: any[]) => void | Promise<void>), ...args: any[]) {
  if (!callback) return;
  void Promise.resolve(callback(...args)).catch(() => {});
}

export const useModalStore = create<ModalStore>((set, get) => ({
  modal: { kind: 'none' },

  openNotice: (title, message, footer, onClose) => set({ modal: { kind: 'notice', title, message, footer, onClose } }),
  openAsk: (options) => set({
    modal: {
      kind: 'ask',
      title: options.title,
      message: options.message,
      value: options.value ?? '',
      footer: options.footer,
      onClose: options.onClose,
      onSubmit: options.onSubmit,
    },
  }),
  openConfirm: (options) => set({
    modal: {
      kind: 'confirm',
      title: options.title,
      message: options.message,
      footer: options.footer,
      onClose: options.onClose,
      onConfirm: options.onConfirm,
    },
  }),
  openSelectOne: (options) => set({
    modal: {
      kind: 'selectOne',
      title: options.title,
      message: options.message,
      choices: options.choices,
      selected: Math.max(0, Math.min(options.selected ?? 0, Math.max(0, options.choices.length - 1))),
      footer: options.footer,
      emptyLabel: options.emptyLabel,
      onClose: options.onClose,
      onSubmit: options.onSubmit,
    },
  }),
  openSelectMany: (options) => set({
    modal: {
      kind: 'selectMany',
      title: options.title,
      message: options.message,
      choices: options.choices,
      selected: Math.max(0, Math.min(options.selected ?? 0, Math.max(0, options.choices.length - 1))),
      picked: options.picked ?? new Set<number>(),
      footer: options.footer,
      emptyLabel: options.emptyLabel,
      onClose: options.onClose,
      onSubmit: options.onSubmit,
    },
  }),
  moveSelection: (delta) => set((state) => {
    if (state.modal.kind !== 'selectOne' && state.modal.kind !== 'selectMany') {
      return state;
    }

    const maxIndex = Math.max(0, state.modal.choices.length - 1);
    const nextSelected = Math.max(0, Math.min(state.modal.selected + delta, maxIndex));
    return { modal: { ...state.modal, selected: nextSelected } };
  }),
  togglePicked: () => set((state) => {
    if (state.modal.kind !== 'selectMany') return state;

    const nextPicked = new Set(state.modal.picked);
    if (nextPicked.has(state.modal.selected)) {
      nextPicked.delete(state.modal.selected);
    } else {
      nextPicked.add(state.modal.selected);
    }

    return { modal: { ...state.modal, picked: nextPicked } };
  }),
  appendInput: (text) => set((state) => {
    if (state.modal.kind !== 'ask') return state;
    return { modal: { ...state.modal, value: state.modal.value + text } };
  }),
  backspaceInput: () => set((state) => {
    if (state.modal.kind !== 'ask') return state;
    return { modal: { ...state.modal, value: state.modal.value.slice(0, -1) } };
  }),
  submit: () => {
    const modal = get().modal;
    set({ modal: { kind: 'none' } });

    if (modal.kind === 'notice') {
      runCallback(modal.onClose);
      return;
    }
    if (modal.kind === 'confirm') {
      runCallback(modal.onConfirm);
      return;
    }
    if (modal.kind === 'ask') {
      runCallback(modal.onSubmit, modal.value);
      return;
    }
    if (modal.kind === 'selectOne') {
      const choice = modal.choices[modal.selected];
      if (choice) {
        runCallback(modal.onSubmit, choice, modal.selected);
      }
      return;
    }
    if (modal.kind === 'selectMany') {
      const indexes = [...modal.picked].sort((a, b) => a - b);
      const choices = indexes
        .map((index) => modal.choices[index])
        .filter((choice): choice is ModalChoice => Boolean(choice));
      runCallback(modal.onSubmit, choices, indexes);
    }
  },
  close: () => {
    const modal = get().modal;
    set({ modal: { kind: 'none' } });

    if (modal.kind === 'none') return;
    runCallback(modal.onClose);
  },
}));
