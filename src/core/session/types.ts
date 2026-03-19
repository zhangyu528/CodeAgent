import { Message } from '../llm/provider';

export type SessionStatus = 'active' | 'ended' | 'interrupted';

export type SessionRecord = {
  id: string;
  title: string;
  status: SessionStatus;
  provider: string;
  model: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionMessageRecord = {
  id: string;
  sessionId: string;
  seq: number;
  role: Message['role'];
  content: string;
  toolName: string | null;
  toolPayload: string | null;
  createdAt: string;
};

export type SessionStartInput = {
  title: string;
  provider: string;
  model: string;
  cwd: string;
};

export type SessionAppendInput = {
  sessionId: string;
  role: Message['role'];
  content: string;
  toolName?: string;
  toolPayload?: unknown;
};

export type SessionSummary = {
  id: string;
  title: string;
  status: SessionStatus;
  updatedAt: string;
  provider: string;
  model: string;
};