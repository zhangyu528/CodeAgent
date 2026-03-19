import { Message } from '../llm/provider';
import { SessionRepository } from './repository';
import { SessionRecord, SessionSummary } from './types';

function titleFromPrompt(prompt: string): string {
  const trimmed = String(prompt || '').trim();
  if (!trimmed) return 'New Session';
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
}

export class SessionService {
  constructor(private readonly repo: SessionRepository) {}

  createSession(input: { initialPrompt: string; provider: string; model: string; cwd: string }): SessionRecord {
    const session = this.repo.startSession({
      title: titleFromPrompt(input.initialPrompt),
      provider: input.provider,
      model: input.model,
      cwd: input.cwd,
    });

    this.repo.appendMessage({
      sessionId: session.id,
      role: 'user',
      content: input.initialPrompt,
    });

    return session;
  }

  createEmptySession(input: { title?: string; provider: string; model: string; cwd: string }): SessionRecord {
    return this.repo.startSession({
      title: input.title?.trim() || 'New Session',
      provider: input.provider,
      model: input.model,
      cwd: input.cwd,
    });
  }

  appendUserMessage(sessionId: string, content: string): void {
    this.repo.appendMessage({ sessionId, role: 'user', content });
  }

  appendAssistantMessage(sessionId: string, content: string): void {
    this.repo.appendMessage({ sessionId, role: 'assistant', content });
  }

  appendToolMessage(sessionId: string, toolName: string, content: string, payload?: unknown): void {
    this.repo.appendMessage({
      sessionId,
      role: 'tool',
      content,
      toolName,
      toolPayload: payload,
    });
  }

  getSessionMessagesAsLLM(sessionId: string): Message[] {
    return this.repo.getMessages(sessionId).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  getSessionMessagesRaw(sessionId: string) {
    return this.repo.getMessages(sessionId);
  }

  listRecentSessions(limit: number = 10): SessionSummary[] {
    return this.repo.listRecentSessions(limit);
  }

  getSession(sessionId: string): SessionRecord | null {
    return this.repo.getSession(sessionId);
  }

  endSession(sessionId: string): void {
    this.repo.setStatus(sessionId, 'ended');
  }

  markInterrupted(sessionId: string): void {
    this.repo.setStatus(sessionId, 'interrupted');
  }
}