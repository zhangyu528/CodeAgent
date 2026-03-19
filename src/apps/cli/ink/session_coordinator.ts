import { AgentController } from '../../../core/controller/agent_controller';
import { Message } from '../../../core/llm/provider';

export class SessionCoordinator {
  constructor(private controller: AgentController) {}

  listRecent(limit: number): Array<{ id: string; title: string }> {
    return this.controller.listRecentSessions(limit).map((s) => ({
      id: s.id,
      title: s.title || 'Untitled Session',
    }));
  }

  startFromWelcome(initialPrompt: string): { sessionId: string | null; title: string } {
    const created = this.controller.createNewSession(initialPrompt);
    const title = this.titleFromPrompt(initialPrompt);
    return {
      sessionId: created?.sessionId || null,
      title,
    };
  }

  resumeFromWelcome(sessionId: string): { sessionId: string; title: string; replay: Message[] } {
    const resumed = this.controller.resumeSession(sessionId);
    const title = this.controller.listRecentSessions(50).find((s) => s.id === sessionId)?.title || 'Resumed Session';
    return {
      sessionId: resumed.sessionId,
      title,
      replay: resumed.replay,
    };
  }

  backToWelcomeFromChat(): void {
    this.controller.endCurrentSession?.();
    this.controller.resetActiveSession?.();
  }

  markInterrupted(): void {
    this.controller.markCurrentSessionInterrupted?.();
  }

  getCurrentSessionId(): string | null {
    return this.controller.getCurrentSessionId();
  }

  private titleFromPrompt(prompt: string): string {
    const raw = (prompt || '').trim();
    if (!raw) return 'New Session';
    return raw.length > 60 ? `${raw.slice(0, 60)}...` : raw;
  }
}