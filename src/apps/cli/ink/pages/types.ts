export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'error';

export type ChatMessageBlock =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string; collapsed?: boolean }
  | { kind: 'reasoning'; text: string; collapsed?: boolean }
  | { kind: 'toolSummary'; text: string; collapsed?: boolean };

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  title: string;
  createdAt: number;
  status?: 'streaming' | 'completed' | 'error';
  blocks: ChatMessageBlock[];
};

export type ChatSessionInfo = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
  messageCount: number;
};
