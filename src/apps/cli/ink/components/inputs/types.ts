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


export type InputAreaProps = {
  value: string;
  page: 'welcome' | 'chat';
  slashVisible: boolean;
  slashItems: Array<{ name: string; description: string; category: string; usage: string }>;
  slashSelected: number;
  modelName: string;
  cwd: string;
  isDimmed?: boolean | undefined;
  exitPromptVisible?: boolean;
  thinking?: boolean;
  usage?: { input: number; output: number; cost: number } | null;
};
