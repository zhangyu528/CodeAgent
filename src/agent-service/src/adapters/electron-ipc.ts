/**
 * Electron IPC Adapter
 *
 * Provides IPC handlers for Electron main process.
 * This preserves the existing Electron behavior while using the service layer.
 */

import type { AgentService } from '../services/types.js';

export interface IpcHandler {
  channel: string;
  handler: (...args: any[]) => Promise<any>;
}

export function createElectronIpcAdapter(service: AgentService): IpcHandler[] {
  return [
    // Session
    { channel: 'agent:init', handler: () => service.init() },
    { channel: 'agent:hasActiveSession', handler: () => Promise.resolve(service.hasActiveSession()) },
    { channel: 'agent:prompt', handler: (_: any, prompt: string) => service.prompt(prompt) },
    { channel: 'agent:getMessages', handler: () => Promise.resolve(service.getMessages()) },
    { channel: 'agent:getSessionId', handler: () => Promise.resolve(service.getSessionId()) },
    { channel: 'agent:listSessions', handler: () => service.listSessions() },
    { channel: 'agent:listSessionGroups', handler: () => service.listSessionGroups() },
    { channel: 'agent:newSession', handler: (_: any, name?: string) => service.createSession(name) },
    { channel: 'agent:newGlobalSession', handler: (_: any, name?: string) => service.createGlobalSession(name) },
    { channel: 'agent:newSessionForProject', handler: (_: any, cwd: string, name?: string) => service.createSessionForProject(cwd, name) },
    { channel: 'agent:switchSession', handler: (_: any, sessionPath: string, projectCwd: string) => {
      console.log('[IPC] agent:switchSession received, sessionPath:', sessionPath, 'projectCwd:', projectCwd);
      return service.switchSession(sessionPath, projectCwd);
    }},
    { channel: 'agent:deleteSession', handler: (_: any, sessionPath: string) => service.deleteSession(sessionPath) },
    { channel: 'agent:renameSession', handler: (_: any, sessionPath: string, newName: string) => service.renameSession(sessionPath, newName) },
    { channel: 'agent:getCurrentCwd', handler: () => service.getCurrentCwd() },

    // Project
    { channel: 'agent:listProjects', handler: () => service.listProjects() },
    { channel: 'agent:activateProject', handler: (_: any, path: string) => service.activateProject(path) },
    { channel: 'agent:deleteProject', handler: (_: any, path: string) => service.deleteProject(path) },
    { channel: 'agent:renameProject', handler: (_: any, path: string, newName: string) => service.renameProject(path, newName) },

    // Model
    { channel: 'agent:getConfig', handler: () => service.getConfig() },
    { channel: 'agent:getProviders', handler: () => service.getProviders() },
    { channel: 'agent:getModels', handler: (_: any, provider: string) => service.getModels(provider) },
    { channel: 'agent:setModel', handler: (_: any, model: { id: string; provider?: string }) => service.setModel(model) },
    { channel: 'agent:saveApiKey', handler: (_: any, provider: string, apiKey: string) => service.saveApiKey(provider, apiKey) },

    // Context
    { channel: 'agent:getContextUsage', handler: () => service.getContextUsage() },
    { channel: 'agent:compact', handler: (_: any, instructions?: string) => service.compact(instructions) },

    // Stats
    { channel: 'agent:getSessionStats', handler: () => service.getSessionStats() },
    { channel: 'agent:getThinkingLevel', handler: () => service.getThinkingLevel() },
    { channel: 'agent:setThinkingLevel', handler: (_: any, level: string) => Promise.resolve(service.setThinkingLevel(level)) },
    { channel: 'agent:cycleThinkingLevel', handler: () => service.cycleThinkingLevel() },

    // Control
    { channel: 'agent:abort', handler: () => Promise.resolve(service.abort()) },

    // Settings
    { channel: 'agent:isFirstRun', handler: () => service.isFirstRun() },
    { channel: 'agent:reloadProviders', handler: () => service.reloadProviders() },
    { channel: 'agent:removeApiKey', handler: (_: any, provider: string) => service.removeApiKey(provider) },

    // Auto-compaction
    { channel: 'agent:setAutoCompaction', handler: (_: any, enabled: boolean) => service.setAutoCompaction(enabled) },
    { channel: 'agent:getAutoCompaction', handler: () => service.getAutoCompaction() },
    { channel: 'agent:isCompacting', handler: () => service.isCompacting() },
  ];
}

export function registerIpcHandlers(ipcMain: any, service: AgentService) {
  const handlers = createElectronIpcAdapter(service);

  for (const { channel, handler } of handlers) {
    ipcMain.handle(channel, async (_event: any, ...args: any[]) => {
      if (channel === 'agent:switchSession') {
        console.log('[IPC wrapper] args:', JSON.stringify(args));
      }
      try {
        // Handler expects (event, ...data), so pass event first
        return await handler(_event, ...args);
      } catch (error: any) {
        console.error(`[IPC] ${channel} error:`, error);
        throw error;
      }
    });
  }

  ipcMain.handle('agent:getAgentHome', async () => {
    return await service.getAgentHome();
  });

  console.log(`[IPC] Registered ${handlers.length + 1} handlers`);
}