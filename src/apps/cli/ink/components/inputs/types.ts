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
  thinking?: boolean;
  usage?: { input: number; output: number; cost: number } | null;
};
