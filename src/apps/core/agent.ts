/**
 * Agent - Singleton & Factory
 * Creates and manages the AgentSession singleton instance
 *
 * @see https://github.com/mariozechner/pi-coding-agent
 */
import {
  createAgentSession,
  AgentSession,
  codingTools,
  findTool,
  grepTool,
  lsTool,
} from '@mariozechner/pi-coding-agent';
import { logger } from './logger.js';
import { getAuthStorage } from './auth.js';
import { getModelRegistry } from './modelRegistry.js';
import { getSessionManager } from './sessionManager.js';
import { getSettingsManager } from './settingsManager.js';
import { getCodeAgentDir } from './agentDir.js';

// ============================================================================
// Singleton Management
// ============================================================================
let agentSession: AgentSession | null = null;
let agentSessionPromise: Promise<AgentSession> | null = null;

/**
 * Initializes the agent session. Call once at bootstrap, await it.
 * Subsequent calls return the same Promise (safe for concurrent access).
 * After initialization, use getAgentSession() to access the instance.
 */
export async function ensureAgentInitialized(): Promise<AgentSession> {
  if (agentSession) return agentSession;

  if (!agentSessionPromise) {
    agentSessionPromise = (async () => {
      logger.info('[Agent] Initializing...');
      // Use the same AuthStorage instance as getAuthStorage() to ensure
      // API keys saved via saveApiKey() are visible to the session.
      const { session } = await createAgentSession({
        agentDir: getCodeAgentDir(),
        authStorage: getAuthStorage(),
        modelRegistry: getModelRegistry(),
        sessionManager: getSessionManager(),
        settingsManager: getSettingsManager(),
        tools: [...codingTools, findTool, grepTool, lsTool],
        cwd: process.cwd(),
      });
      agentSession = session;
      logger.info('[Agent] Initialized successfully');
      return session;
    })();
  }

  return agentSessionPromise;
}

/**
 * Synchronous access to the agent instance.
 * Call this ONLY after ensureAgentInitialized() has completed.
 */
export function getAgent() {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized. Call ensureAgentInitialized() and await it first.');
  }
  return agentSession.agent;
}

/**
 * Access the AgentSession singleton directly (internal use only).
 * External code should use getAgent(), getSessionManager(), getAgentEvents().
 */
export function getAgentSession(): AgentSession {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized. Call ensureAgentInitialized() and await it first.');
  }
  return agentSession;
}

/**
 * Switch to an existing session by id.
 * Requires ensureAgentInitialized() to have completed.
 */
/**
 * Switch to a different session by file path.
 * Requires ensureAgentInitialized() to have completed.
 */
export function switchSession(sessionPath: string): Promise<boolean> {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  return agentSession.switchSession(sessionPath);
}

/**
 * Create a new session and return its id.
 * Requires ensureAgentInitialized() to have completed.
 */
export function newSession(): string {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  agentSession.newSession();
  return agentSession.sessionId;
}

/**
 * Set the active model.
 * Requires ensureAgentInitialized() to have completed.
 */
export function setModel(model: any): Promise<void> {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  return agentSession.setModel(model);
}

/**
 * Get the current session id.
 */
export function getSessionId(): string {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  return agentSession.sessionId;
}

/**
 * Get the current session name.
 */
export function getSessionName(): string | undefined {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  return agentSession.sessionName;
}

/**
 * Set the current session name.
 */
export function setSessionName(name: string): void {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  agentSession.setSessionName(name);
}

/**
 * Get the current session messages.
 */
export function getSessionMessages(): any[] {
  if (!agentSession) {
    throw new Error('[Agent] Not initialized.');
  }
  return agentSession.messages as any[];
}

/**
 * Get the current session file path.
 */
export function getSessionFile(): string | undefined {
  if (!agentSession) {
    return undefined;
  }
  return agentSession.sessionFile;
}
