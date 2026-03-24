import React from 'react';

export type ChatLine = { id: string; text: string };

export type WelcomeProps = {
  version: string;
  cwd: string;
  provider?: string;
  logs: string[];
  rows: number;
  cols: number;
  isDimmed?: boolean;
  children?: React.ReactNode;
};

export type ChatHeaderProps = {
  title: string;
  shortSessionId: string;
};

export type ChatPageProps = {
  lines: ChatLine[];
  isDimmed?: boolean;
};

export type InputBarProps = {
  value: string;
  page: 'welcome' | 'chat';
  placeholder?: string;
};

export type SlashPaletteProps = {
  visible: boolean;
  items: Array<{ name: string; description: string; category: string; usage: string }>;
  selectedIndex: number;
  query: string;
};

export type HistoryPickerProps = {
  visible: boolean;
  items: Array<{ id: string; title: string }>;
  selectedIndex: number;
};

export type ChoicePrompt =
  | { kind: 'none' }
  | { kind: 'ask'; message: string; value: string }
  | { kind: 'confirm'; message: string }
  | { kind: 'selectOne'; message: string; choices: string[]; selected: number }
  | { kind: 'selectMany'; message: string; choices: string[]; selected: number; picked: Set<number> };

export type InputAreaProps = {
  value: string;
  page: 'welcome' | 'chat';
  slashVisible: boolean;
  slashItems: Array<{ name: string; description: string; category: string; usage: string }>;
  slashSelected: number;
  historyVisible: boolean;
  historyItems: Array<{ id: string; title: string }>;
  historySelected: number;
  modelName: string;
  cwd: string;
  isDimmed?: boolean;
  exitPromptVisible?: boolean;
};
