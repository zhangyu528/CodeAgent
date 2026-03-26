export type ChoicePrompt =
  | { kind: 'none' }
  | { kind: 'ask'; message: string; value: string }
  | { kind: 'confirm'; message: string }
  | { kind: 'selectOne'; message: string; choices: string[]; selected: number }
  | { kind: 'selectMany'; message: string; choices: string[]; selected: number; picked: Set<number> };

export type ModalOverlayProps = {
  prompt: ChoicePrompt;
  columns: number;
  rows: number;
  apiKeyInput?: string;
};
