export type ModalState =
  | { kind: 'none' }
  | { kind: 'ask'; message: string; value: string }
  | { kind: 'confirm'; message: string }
  | { kind: 'selectOne'; message: string; choices: string[]; selected: number }
  | { kind: 'selectMany'; message: string; choices: string[]; selected: number; picked: Set<number> };

export type ModalOverlayProps = {
  modal: ModalState;
  columns: number;
  rows: number;
  apiKeyInput?: string;
};
