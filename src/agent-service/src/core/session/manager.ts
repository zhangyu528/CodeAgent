/**
 * Session Manager API - facade for agent's SessionManager
 */
import { SessionManager } from '@mariozechner/pi-coding-agent';
import type { SessionInfo } from '@mariozechner/pi-coding-agent';

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    // Let SessionManager compute sessionDir internally via getDefaultSessionDir(cwd)
    // This ensures create() and list() use the same path
    sessionManagerInstance = SessionManager.create(process.cwd());
  }
  return sessionManagerInstance;
}

/**
 * List all sessions for the current project.
 * Uses the SessionManager's sessionDir internally, unlike the static SessionManager.list().
 */
export async function listSessions(): Promise<SessionInfo[]> {
  const sm = getSessionManager();
  const cwd = sm.getCwd();
  const sessionDir = sm.getSessionDir();
  console.info(`[listSessions] cwd=${cwd}, sessionDir=${sessionDir}`);
  const sessions = await SessionManager.list(cwd, sessionDir);
  console.info(`[listSessions] found ${sessions.length} sessions`);
  return sessions;
}
