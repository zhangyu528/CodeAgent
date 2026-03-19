import { SessionService } from '../../core/session/service';
import { SessionRepository } from '../../core/session/repository';
import { SessionAppendInput, SessionMessageRecord, SessionRecord, SessionStartInput, SessionStatus, SessionSummary } from '../../core/session/types';

class InMemorySessionRepository implements SessionRepository {
  private sessions: SessionRecord[] = [];
  private messages: SessionMessageRecord[] = [];

  startSession(input: SessionStartInput): SessionRecord {
    const now = new Date().toISOString();
    const row: SessionRecord = {
      id: `s_${this.sessions.length + 1}`,
      title: input.title,
      status: 'active',
      provider: input.provider,
      model: input.model,
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.unshift(row);
    return row;
  }

  appendMessage(input: SessionAppendInput): SessionMessageRecord {
    const seq = this.messages.filter(m => m.sessionId === input.sessionId).length + 1;
    const row: SessionMessageRecord = {
      id: `m_${this.messages.length + 1}`,
      sessionId: input.sessionId,
      seq,
      role: input.role,
      content: input.content,
      toolName: input.toolName || null,
      toolPayload: input.toolPayload === undefined ? null : JSON.stringify(input.toolPayload),
      createdAt: new Date().toISOString(),
    };
    this.messages.push(row);
    return row;
  }

  listRecentSessions(limit: number): SessionSummary[] {
    return this.sessions.slice(0, limit).map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      updatedAt: s.updatedAt,
      provider: s.provider,
      model: s.model,
    }));
  }

  getSession(sessionId: string): SessionRecord | null {
    return this.sessions.find(s => s.id === sessionId) || null;
  }

  getMessages(sessionId: string): SessionMessageRecord[] {
    return this.messages.filter(m => m.sessionId === sessionId).sort((a, b) => a.seq - b.seq);
  }

  setStatus(sessionId: string, status: SessionStatus): void {
    const row = this.sessions.find(s => s.id === sessionId);
    if (!row) return;
    row.status = status;
    row.updatedAt = new Date().toISOString();
  }
}

export async function test() {
  console.log('=== Running Unit Test: SessionService ===');

  const repo = new InMemorySessionRepository();
  const service = new SessionService(repo);

  const created = service.createSession({
    initialPrompt: 'hello from test',
    provider: 'mock',
    model: 'mock-model',
    cwd: process.cwd(),
  });

  if (!created.id) throw new Error('session id is empty');
  if (service.listRecentSessions(1).length !== 1) throw new Error('recent sessions should contain created session');

  service.appendAssistantMessage(created.id, 'assistant response');
  const replay = service.getSessionMessagesAsLLM(created.id);
  if (replay.length !== 2) throw new Error(`expected 2 replay messages, got ${replay.length}`);
  if (replay[0]?.role !== 'user') throw new Error('first replay message should be user');
  if (replay[1]?.role !== 'assistant') throw new Error('second replay message should be assistant');

  service.markInterrupted(created.id);
  const interrupted = service.getSession(created.id);
  if (!interrupted || interrupted.status !== 'interrupted') throw new Error('status should be interrupted');

  service.endSession(created.id);
  const ended = service.getSession(created.id);
  if (!ended || ended.status !== 'ended') throw new Error('status should be ended');

  console.log('✅ SessionService checks passed.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ SessionService test failed:', e.message);
    process.exit(1);
  });
}