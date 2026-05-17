/**
 * Agent Service - Core Service Implementation
 */

import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';
import { AgentService, type Session, type SessionGroup } from './types.js';
import {
  ensureAgentInitialized,
  getAgent,
  getAgentSession,
  hasActiveSession,
  listAllSessions,
  activateProject,
  unregisterProject,
  getContextUsage,
  setModel,
  compact,
  abort,
  getSessionId,
  getSessionMessages,
  getActiveCwd,
  newSession as sessionCreator,
  newGlobalSession as globalSessionCreator,
  activateSession,
  renameSession,
  deleteSession,
  setAutoCompaction,
  getAutoCompaction,
  isCompacting,
} from '../core/index.js';

import { getAgentDir } from '../core/project/agentDir.js';
import { getProviders, getModels, ensureProvidersLoaded } from '../core/model/index.js';
import { getSettingsManager } from '../core/model/settings.js';
import { saveApiKey, removeApiKey, checkApiKeyConfigured, isFirstRun } from '../core/auth/index.js';
import { listProjects, renameProject as renameProjectCore } from '../core/project/index.js';

export async function createAgentService(): Promise<AgentService> {
  await ensureAgentInitialized();

  return {
    async init() {
      try {
        const session = getAgentSession();
        return {
          success: true,
          sessionId: session?.sessionId ?? null,
        };
      } catch {
        return { success: true, sessionId: null };
      }
    },

    hasActiveSession() {
      return hasActiveSession();
    },

    async prompt(promptText: string) {
      const agent = getAgent();
      if (!agent) return { success: false, error: 'No agent' };
      try {
        await agent.prompt(promptText);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    getMessages() {
      try {
        return getSessionMessages();
      } catch {
        return [];
      }
    },

    getSessionId() {
      try {
        return getSessionId();
      } catch {
        return null;
      }
    },

    async listSessions() {
      return listAllSessions();
    },

    async listSessionGroups(): Promise<SessionGroup> {
      const sessions = await listAllSessions();
      const groups: SessionGroup = { global: [], byProject: {} };

      for (const session of sessions) {
        if (!session.cwd) {
          groups.global.push(session);
        } else {
          if (!groups.byProject[session.cwd]) {
            groups.byProject[session.cwd] = [];
          }
          groups.byProject[session.cwd].push(session);
        }
      }

      return groups;
    },

    // Session management
    async createSession(name?: string) {
      const result = await sessionCreator(name);
      return { success: true, sessionId: result.id, sessionPath: result.path };
    },

    async createGlobalSession(name?: string) {
      const result = await globalSessionCreator(name);
      return { success: true, sessionId: result.id, sessionPath: result.path };
    },

    async createSessionForProject(cwd: string, name?: string) {
      await activateProject(cwd);
      const result = await sessionCreator(name);
      return { success: true, sessionId: result.id, sessionPath: result.path };
    },

    async switchSession(sessionPath: string, projectCwd: string) {
      console.log('[Service] switchSession:', sessionPath, 'projectCwd:', projectCwd);
      // Validate sessionPath is a file (not a directory)
      if (!sessionPath || sessionPath.trim() === '') {
        throw new Error('Invalid session path');
      }
      await activateSession(sessionPath, projectCwd);
    },

    async deleteSession(sessionPath: string) {
      await deleteSession(sessionPath);
    },

    async renameSession(sessionPath: string, newName: string) {
      await renameSession(sessionPath, newName);
    },

    // Project
    async listProjects() {
      return listProjects();
    },

    async activateProject(path: string) {
      await activateProject(path);
      return { success: true };
    },

    async deleteProject(path: string) {
      unregisterProject(path);
    },

    async renameProject(path: string, newName: string) {
      renameProjectCore(path, newName);
    },

    async getCurrentCwd() {
      return getActiveCwd();
    },

    // Model
    async getConfig() {
      await ensureProvidersLoaded();
      const providers = getProviders() ?? [];
      const settings = getSettingsManager();
      return {
        providers: providers.map(p => ({ id: p, hasApiKey: checkApiKeyConfigured(p) })),
        currentModel: (settings as any).model ?? null,
      };
    },

    async getProviders() {
      await ensureProvidersLoaded();
      const providers = getProviders() ?? [];
      return providers.map(p => ({ id: p, hasApiKey: checkApiKeyConfigured(p) }));
    },

    async getModels(provider: string) {
      const models = getModels(provider) ?? [];
      return models.map(m => ({ id: m.id, provider: m.provider }));
    },

    async setModel(model: { id: string; provider?: string }) {
      await setModel(model);
    },

    async saveApiKey(provider: string, apiKey: string) {
      const saved = saveApiKey(provider, apiKey);
      return { success: saved };
    },

    async removeApiKey(provider: string) {
      removeApiKey(provider);
      return { success: true };
    },

    async isFirstRun() {
      return isFirstRun();
    },

    async reloadProviders() {
      return { success: true, providers: getProviders() ?? [] };
    },

    // Context
    getContextUsage() {
      return getContextUsage();
    },

    async compact(instructions?: string) {
      await compact(instructions);
      return { success: true };
    },

    async setAutoCompaction(enabled: boolean) {
      setAutoCompaction(enabled);
      return { success: true };
    },

    async getAutoCompaction() {
      try {
        return getAutoCompaction();
      } catch {
        return false;
      }
    },

    async isCompacting() {
      try {
        return isCompacting();
      } catch {
        return false;
      }
    },

    // Stats
    getSessionStats() {
      try {
        const session = getAgentSession();
        return session?.getSessionStats?.() ?? null;
      } catch {
        return null;
      }
    },

    async getThinkingLevel() {
      try {
        const session = getAgentSession();
        return {
          level: (session as any)?.thinkingLevel ?? 'medium',
          supportsThinking: false,
          availableLevels: [],
        };
      } catch {
        return {
          level: 'medium',
          supportsThinking: false,
          availableLevels: [],
        };
      }
    },

    setThinkingLevel(level: string) {
      try {
        const session = getAgentSession();
        if (session?.setThinkingLevel) {
          session.setThinkingLevel(level as any);
        }
      } catch {
        // No active session
      }
    },

    async cycleThinkingLevel() {
      return { success: true, level: 'medium' };
    },

    abort() {
      try {
        abort();
      } catch {
        // No active session to abort
      }
    },

    // Events
    onEvent(callback: (event: AgentSessionEvent) => void) {
      try {
        const session = getAgentSession();
        if (session?.subscribe) {
          return session.subscribe(callback);
        }
      } catch {
        // No active session yet
      }
      return () => {};
    },

    // Platform-specific (handled in Electron main.ts)
    async getAgentHome() {
      return getAgentDir();
    },
  };
}

export type { AgentService } from './types.js';