/**
 * API 封装 - IPC 调用
 */

import type { AgentAPI, ShellAPI } from './types';

// agent API 直接代理到 window.agent
export const agent: AgentAPI = {
  // Init
  init: () => window.agent.init(),

  // Session
  hasActiveSession: () => window.agent.hasActiveSession(),
  prompt: (text) => window.agent.prompt(text),
  getMessages: () => window.agent.getMessages(),
  getSessionId: () => window.agent.getSessionId(),
  listSessions: () => window.agent.listSessions(),
  listSessionGroups: () => window.agent.listSessionGroups(),
  newSession: (name) => window.agent.newSession(name),
  newGlobalSession: (name) => window.agent.newGlobalSession(name),
  newSessionForProject: (cwd, name) => window.agent.newSessionForProject(cwd, name),
  switchSession: (path, cwd) => {
    console.log('[api.ts] switchSession called, path:', path, 'cwd:', cwd);
    return window.agent.switchSession(path, cwd);
  },
  deleteSession: (path) => window.agent.deleteSession(path),
  renameSession: (path, name) => window.agent.renameSession(path, name),

  // Project
  listProjects: () => window.agent.listProjects(),
  activateProject: (path) => window.agent.activateProject(path),
  deleteProject: (path) => window.agent.deleteProject(path),
  renameProject: (path, newName) => window.agent.renameProject(path, newName),
  selectDirectory: () => window.agent.selectDirectory(),

  // Model
  getConfig: () => window.agent.getConfig(),
  getProviders: () => window.agent.getProviders(),
  getModels: (provider) => window.agent.getModels(provider),
  setModel: (model) => window.agent.setModel(model),
  saveApiKey: (provider, key) => window.agent.saveApiKey(provider, key),
  removeApiKey: (provider) => window.agent.removeApiKey(provider),
  isFirstRun: () => window.agent.isFirstRun(),
  reloadProviders: () => window.agent.reloadProviders(),

  // Context
  getContextUsage: () => window.agent.getContextUsage(),
  compact: (instructions) => window.agent.compact(instructions),
  setAutoCompaction: (enabled) => window.agent.setAutoCompaction(enabled),
  getAutoCompaction: () => window.agent.getAutoCompaction(),
  isCompacting: () => window.agent.isCompacting(),

  // Stats
  getSessionStats: () => window.agent.getSessionStats(),
  getThinkingLevel: () => window.agent.getThinkingLevel(),
  setThinkingLevel: (level) => window.agent.setThinkingLevel(level),
  cycleThinkingLevel: () => window.agent.cycleThinkingLevel(),

  // Control
  abort: () => window.agent.abort(),

  // Events
  onEvent: (callback) => window.agent.onEvent(callback),

  // Utils
  getCurrentCwd: () => window.agent.getCurrentCwd(),
  getAgentHome: () => window.agent.getAgentHome(),
};

// shell API
export const shell: ShellAPI = {
  openExternal: (url) => window.shell.openExternal(url),
};