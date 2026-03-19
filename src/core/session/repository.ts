import { SessionAppendInput, SessionMessageRecord, SessionRecord, SessionStartInput, SessionStatus, SessionSummary } from './types';

export interface SessionRepository {
  startSession(input: SessionStartInput): SessionRecord;
  appendMessage(input: SessionAppendInput): SessionMessageRecord;
  listRecentSessions(limit: number): SessionSummary[];
  getSession(sessionId: string): SessionRecord | null;
  getMessages(sessionId: string): SessionMessageRecord[];
  setStatus(sessionId: string, status: SessionStatus): void;
}