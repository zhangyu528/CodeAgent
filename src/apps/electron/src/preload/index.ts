/**
 * Context Bridge — Expose safe API to renderer via contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';

type AgentCallback = (event: unknown) => void;

contextBridge.exposeInMainWorld('agent', {
  init: () => ipcRenderer.invoke('agent:init'),
  hasActiveSession: () => ipcRenderer.invoke('agent:hasActiveSession'),
  prompt: (text: string) => ipcRenderer.invoke('agent:prompt', text),
  getMessages: () => ipcRenderer.invoke('agent:getMessages'),
  getSessionId: () => ipcRenderer.invoke('agent:getSessionId'),
  listSessions: () => ipcRenderer.invoke('agent:listSessions'),
  listSessionGroups: () => ipcRenderer.invoke('agent:listSessionGroups'),
  onEvent: (callback: AgentCallback) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on('agent:event', handler);
    return () => ipcRenderer.removeListener('agent:event', handler);
  },
  getConfig: () => ipcRenderer.invoke('agent:getConfig'),
  getProviders: () => ipcRenderer.invoke('agent:getProviders'),
  getModels: (provider: string) => ipcRenderer.invoke('agent:getModels', provider),
  setModel: (model: { id: string; provider?: string }) => ipcRenderer.invoke('agent:setModel', model),
  saveApiKey: (provider: string, key: string) => ipcRenderer.invoke('agent:saveApiKey', provider, key),
  removeApiKey: (provider: string) => ipcRenderer.invoke('agent:removeApiKey', provider),
  isFirstRun: () => ipcRenderer.invoke('agent:isFirstRun'),
  reloadProviders: () => ipcRenderer.invoke('agent:reloadProviders'),
  abort: () => ipcRenderer.invoke('agent:abort'),
  getContextUsage: () => ipcRenderer.invoke('agent:getContextUsage'),
  compact: (instructions?: string) => ipcRenderer.invoke('agent:compact', instructions),
  setAutoCompaction: (enabled: boolean) => ipcRenderer.invoke('agent:setAutoCompaction', enabled),
  getAutoCompaction: () => ipcRenderer.invoke('agent:getAutoCompaction'),
  isCompacting: () => ipcRenderer.invoke('agent:isCompacting'),
  getSessionStats: () => ipcRenderer.invoke('agent:getSessionStats'),
  getThinkingLevel: () => ipcRenderer.invoke('agent:getThinkingLevel'),
  setThinkingLevel: (level: string) => ipcRenderer.invoke('agent:setThinkingLevel', level),
  cycleThinkingLevel: () => ipcRenderer.invoke('agent:cycleThinkingLevel'),
  listProjects: () => ipcRenderer.invoke('agent:listProjects'),
  activateProject: (path: string) => ipcRenderer.invoke('agent:activateProject', path),
  deleteProject: (path: string) => ipcRenderer.invoke('agent:deleteProject', path),
  renameProject: (path: string, newName: string) => ipcRenderer.invoke('agent:renameProject', path, newName),
  selectDirectory: () => ipcRenderer.invoke('agent:selectDirectory'),
  newSession: (name?: string) => ipcRenderer.invoke('agent:newSession', name),
  newGlobalSession: (name?: string) => ipcRenderer.invoke('agent:newGlobalSession', name),
  newSessionForProject: (cwd: string, name?: string) => ipcRenderer.invoke('agent:newSessionForProject', cwd, name),
  createSession: (name?: string) => ipcRenderer.invoke('agent:newSession', name),
  createGlobalSession: (name?: string) => ipcRenderer.invoke('agent:newGlobalSession', name),
  createSessionForProject: (cwd: string, name?: string) => ipcRenderer.invoke('agent:newSessionForProject', cwd, name),
  switchSession: (path: string, cwd: string) => {
    console.log('[preload] switchSession, path:', path, 'cwd:', cwd);
    return ipcRenderer.invoke('agent:switchSession', path, cwd);
  },
  deleteSession: (path: string) => ipcRenderer.invoke('agent:deleteSession', path),
  renameSession: (path: string, name: string) => ipcRenderer.invoke('agent:renameSession', path, name),
  getCurrentCwd: () => ipcRenderer.invoke('agent:getCurrentCwd'),
  getAgentHome: () => ipcRenderer.invoke('agent:getAgentHome'),
});

contextBridge.exposeInMainWorld('shell', {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});