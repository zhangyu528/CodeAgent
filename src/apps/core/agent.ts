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
import { getAuthStorage } from './apiKey.js';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// Singleton Management
// ============================================================================
let sessionInstance: AgentSession | null = null;
let initPromise: Promise<AgentSession> | null = null;

function getCodeAgentDir(): string {
  return join(homedir(), '.codeagent');
}

/**
 * Initializes the agent session. Call once at bootstrap, await it.
 * Subsequent calls return the same Promise (safe for concurrent access).
 * After initialization, use getAgentSession() to access the instance.
 */
export async function ensureAgentInitialized(): Promise<AgentSession> {
  if (sessionInstance) return sessionInstance;

  if (!initPromise) {
    initPromise = (async () => {
      logger.info('[Agent] Initializing...');
      // Use the same AuthStorage instance as getAuthStorage() to ensure
      // API keys saved via saveApiKey() are visible to the session.
      const authStorage = getAuthStorage();
      const agentDir = getCodeAgentDir();
      const { session } = await createAgentSession({
        authStorage,
        agentDir,
        tools: [...codingTools, findTool, grepTool, lsTool],
        cwd: process.cwd(),
      });
      sessionInstance = session;
      logger.info('[Agent] Initialized successfully');
      return session;
    })();
  }

  return initPromise;
}

/**
 * Synchronous access to the initialized session.
 * Call this ONLY after ensureAgentInitialized() has completed.
 */
export function getAgentSession(): AgentSession {
  if (!sessionInstance) {
    throw new Error('[Agent] Not initialized. Call ensureAgentInitialized() and await it first.');
  }
  return sessionInstance;
}
