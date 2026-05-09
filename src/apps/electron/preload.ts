/**
 * Preload Script — Secure bridge between renderer and main process.
 *
 * Exposes a typed API to the renderer via contextBridge.
 * Renderer never gets direct access to Node.js/Electron APIs.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';

// ─── Type definitions for the exposed API ─────────────────────────────────────

export interface SessionInfo {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
}

export interface ProjectInfo {
  path: string;
  name: string;
  createdAt: number;
}

export interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export interface AgentAPI {
  init: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  hasActiveSession: () => Promise<boolean>;
  prompt: (prompt: string) => Promise<{ success: boolean; error?: string }>;
  getMessages: () => Promise<unknown[]>;
  getSessionId: () => Promise<string>;
  listSessions: () => Promise<SessionInfo[]>;
  onEvent: (callback: (event: AgentSessionEvent) => void) => () => void;

  // Model configuration
  getConfig: () => Promise<{ providers: string[]; currentModel: string | null; error?: string }>;
  getProviders: () => Promise<{ id: string; hasApiKey: boolean }[]>;
  getModels: (provider: string) => Promise<{ id: string; provider: string }[]>;
  setModel: (model: {
    id: string;
    provider?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  saveApiKey: (provider: string, apiKey: string) => Promise<{ success: boolean }>;
  removeApiKey: (provider: string) => Promise<{ success: boolean }>;
  isFirstRun: () => Promise<boolean>;
  reloadProviders: () => Promise<{ success: boolean; providers?: string[]; error?: string }>;
  abort: () => Promise<{ success: boolean; error?: string }>;
  debugList: () => Promise<{ sessionsBase: string; dirs: string[]; error?: string }>;
  debugReadDir: (dirName: string) => Promise<{ dirPath: string; files: string[]; error?: string }>;
  debugReadFile: (
    filePath: string
  ) => Promise<{ ok: boolean; lineCount?: number; firstLine?: string; error?: string }>;

  // Context APIs
  getContextUsage: () => Promise<ContextUsage | null>;
  compact: (
    instructions?: string
  ) => Promise<{ success: boolean; summary?: string; error?: string }>;
  setAutoCompaction: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  getAutoCompaction: () => Promise<boolean>;
  isCompacting: () => Promise<boolean>;

  // Session stats & thinking
  getSessionStats: () => Promise<{
    sessionId: string;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    toolResults: number;
    totalMessages: number;
    tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
    cost: number;
  } | null>;
  getThinkingLevel: () => Promise<{
    level: string;
    supportsThinking: boolean;
    availableLevels: string[];
  }>;
  setThinkingLevel: (level: string) => Promise<{ success: boolean; error?: string }>;
  cycleThinkingLevel: () => Promise<{ success: boolean; level?: string; error?: string }>;

  // Project management
  listProjects: () => Promise<ProjectInfo[]>;
  activateProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  renameProject: (
    projectPath: string,
    newName: string
  ) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;
  newSessionForProject: (
    cwd: string,
    name?: string
  ) => Promise<{ success: boolean; sessionId?: string; sessionPath?: string; error?: string }>;
  getAgentHome: () => Promise<string>;

  // Session management
  newSession: (name?: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  newGlobalSession: (
    name?: string
  ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  switchSession: (
    sessionPath: string,
    projectCwd: string
  ) => Promise<{ success: boolean; error?: string }>;
  renameSession: (
    sessionPath: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSession: (sessionPath: string) => Promise<{ success: boolean; error?: string }>;
  getCurrentCwd: () => Promise<string>;
}

export interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
}

// ─── Expose APIs to renderer ─────────────────────────────────────────────────

contextBridge.exposeInMainWorld('agent', {
  init: () => ipcRenderer.invoke('agent:init'),
  hasActiveSession: () => ipcRenderer.invoke('agent:hasActiveSession'),
  prompt: (prompt: string) => ipcRenderer.invoke('agent:prompt', prompt),
  getMessages: () => ipcRenderer.invoke('agent:getMessages'),
  getSessionId: () => ipcRenderer.invoke('agent:getSessionId'),
  listSessions: () => ipcRenderer.invoke('agent:listSessions'),
  onEvent: (callback: (event: AgentSessionEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: AgentSessionEvent) => callback(data);
    ipcRenderer.on('agent:event', handler);
    return () => ipcRenderer.removeListener('agent:event', handler);
  },

  // Model configuration
  getConfig: () => ipcRenderer.invoke('agent:getConfig'),
  getProviders: () => ipcRenderer.invoke('agent:getProviders'),
  getModels: (provider: string) => ipcRenderer.invoke('agent:getModels', provider),
  setModel: (model: { id: string; provider?: string }) =>
    ipcRenderer.invoke('agent:setModel', model),
  saveApiKey: (provider: string, apiKey: string) =>
    ipcRenderer.invoke('agent:saveApiKey', provider, apiKey),
  removeApiKey: (provider: string) => ipcRenderer.invoke('agent:removeApiKey', provider),
  isFirstRun: () => ipcRenderer.invoke('agent:isFirstRun'),
  reloadProviders: () => ipcRenderer.invoke('agent:reloadProviders'),
  abort: () => ipcRenderer.invoke('agent:abort'),
  debugList: () => ipcRenderer.invoke('agent:debugList'),
  debugReadDir: (dirName: string) => ipcRenderer.invoke('agent:debugReadDir', dirName),
  debugReadFile: (filePath: string) => ipcRenderer.invoke('agent:debugReadFile', filePath),

  // Context APIs
  getContextUsage: () => ipcRenderer.invoke('agent:getContextUsage'),
  compact: (instructions?: string) => ipcRenderer.invoke('agent:compact', instructions),
  setAutoCompaction: (enabled: boolean) => ipcRenderer.invoke('agent:setAutoCompaction', enabled),
  getAutoCompaction: () => ipcRenderer.invoke('agent:getAutoCompaction'),
  isCompacting: () => ipcRenderer.invoke('agent:isCompacting'),

  // Session stats & thinking
  getSessionStats: () => ipcRenderer.invoke('agent:getSessionStats'),
  getThinkingLevel: () => ipcRenderer.invoke('agent:getThinkingLevel'),
  setThinkingLevel: (level: string) => ipcRenderer.invoke('agent:setThinkingLevel', level),
  cycleThinkingLevel: () => ipcRenderer.invoke('agent:cycleThinkingLevel'),

  // Project management
  listProjects: () => ipcRenderer.invoke('agent:listProjects'),
  activateProject: (projectPath: string) =>
    ipcRenderer.invoke('agent:activateProject', projectPath),
  deleteProject: (projectPath: string) => ipcRenderer.invoke('agent:deleteProject', projectPath),
  renameProject: (projectPath: string, newName: string) =>
    ipcRenderer.invoke('agent:renameProject', projectPath, newName),
  selectDirectory: () => ipcRenderer.invoke('agent:selectDirectory'),
  newSessionForProject: (cwd: string, name?: string) =>
    ipcRenderer.invoke('agent:newSessionForProject', cwd, name),
  getAgentHome: () => ipcRenderer.invoke('agent:getAgentHome'),

  // Session management
  newSession: (name?: string) => ipcRenderer.invoke('agent:newSession', name),
  newGlobalSession: (name?: string) => ipcRenderer.invoke('agent:newGlobalSession', name),
  switchSession: (sessionPath: string, projectCwd: string) =>
    ipcRenderer.invoke('agent:switchSession', sessionPath, projectCwd),
  renameSession: (sessionPath: string, name: string) =>
    ipcRenderer.invoke('agent:renameSession', sessionPath, name),
  deleteSession: (sessionPath: string) => ipcRenderer.invoke('agent:deleteSession', sessionPath),
  getCurrentCwd: () => ipcRenderer.invoke('agent:getCurrentCwd'),
} as AgentAPI);

contextBridge.exposeInMainWorld('shell', {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
} as ShellAPI);
