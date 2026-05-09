/**
 * Electron Main Process
 *
 * Entry point for CodeAgent desktop app.
 * All Node.js logic (AgentSession, tools, SQLite) runs here.
 * Renderer (UI) communicates via IPC.
 */
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path, { join } from 'path';
import { fileURLToPath } from 'url';
import {
  ensureAgentInitialized,
  getAgent,
  getAgentSession,
  hasActiveSession,
  activateProject,
  activateSession,
  registerProject,
  unregisterProject,
  renameProjectByPath,
  newSession,
  newGlobalSession,
  renameSession,
  deleteSession,
  listAllSessions,
  subscribeToActiveSession,
  getActiveCwd,
  getSessionId,
  getSessionName,
  getSessionMessages,
  getContextUsage,
  setModel,
  compact,
  setAutoCompaction,
  abort,
  exportSession,
  prompt,
  logger,
  listProjects,
  ensureProvidersLoaded,
  getProviders,
  getModels,
  checkApiKeyConfigured,
  saveApiKey,
  removeApiKey,
  reloadProviders,
  isFirstRun,
} from '../../core/index.js';
import { getAgentDir } from '@mariozechner/pi-coding-agent';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';

// In CJS mode, use __dirname directly. In ESM mode, derive from import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WSL headless: disable /dev/shm and disable GPU
if (process.platform !== 'win32' && process.platform !== 'darwin') {
  app.commandLine.appendSwitch('disable-dev-shm');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

// ─── Window creation ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CodeAgent',
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Needed for @mariozechner/pi-coding-agent
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Electron window created');
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('agent:hasActiveSession', () => {
  return hasActiveSession();
});

ipcMain.handle('agent:init', async () => {
  try {
    await ensureAgentInitialized();
    // Return current session info if a session is already active
    let sessionId = null;
    try {
      sessionId = getSessionId();
    } catch {
      // No active session yet — that's ok
    }
    return { success: true, sessionId };
  } catch (err) {
    logger.error('agent:init failed', { err });
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:prompt', async (_event, promptText: string) => {
  const unsubscribe = subscribeToActiveSession((evt: AgentSessionEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', evt);
    }
  });

  try {
    logger.info('[agent:prompt] starting, prompt length:', promptText.length);
    const timeoutMs = 60_000;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Prompt timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    );
    await Promise.race([prompt(promptText), timeout]);
    logger.info('[agent:prompt] completed successfully');
    return { success: true };
  } catch (err) {
    logger.error('agent:prompt failed', { err });
    return { success: false, error: String(err) };
  } finally {
    unsubscribe();
  }
});

ipcMain.handle('agent:getMessages', async () => {
  try {
    return getSessionMessages();
  } catch {
    return [];
  }
});

ipcMain.handle('agent:getSessionId', async () => {
  return getSessionId();
});

// Debug: read a specific session file
ipcMain.handle('agent:debugReadFile', async (_event, filePath: string) => {
  try {
    const { readFileSync } = await import('fs');
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    return { ok: true, lineCount: lines.length, firstLine: lines[0]?.slice(0, 200) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('agent:listSessions', async () => {
  try {
    return await listAllSessions();
  } catch (err: any) {
    logger.error('[agent:listSessions] error:', err);
    return [];
  }
});

/**
 * Switch to a different session (possibly in a different project).
 * The session's cwd (from its header) is baked into its AgentSession at creation time,
 * so tools automatically operate in the correct project directory.
 */
ipcMain.handle('agent:switchSession', async (_event, sessionPath: string, projectCwd: string) => {
  try {
    const { existsSync } = await import('fs');
    if (!existsSync(sessionPath)) {
      return { success: false, error: 'Session not found: ' + sessionPath };
    }
    await activateSession(sessionPath, projectCwd);
    return { success: true };
  } catch (err: any) {
    logger.error('[agent:switchSession] error:', err);
    return { success: false, error: String(err) };
  }
});

/**
 * Create a new session in a specific project directory and activate it.
 */
ipcMain.handle('agent:newSessionForProject', async (_event, targetCwd: string, name?: string) => {
  try {
    const project = registerProject(targetCwd, name);
    await activateProject(project.path);
    const { id, path: sessionPath } = await newSession(name);
    return { success: true, sessionId: id, sessionPath };
  } catch (err: any) {
    logger.error('[agent:newSessionForProject] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:newGlobalSession', async (_event, name?: string) => {
  try {
    const { id, path: sessionPath } = await newGlobalSession(name);
    return { success: true, sessionId: id, sessionPath };
  } catch (err: any) {
    logger.error('[agent:newGlobalSession] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:newSession', async (_event, name?: string) => {
  try {
    const { id, path: sessionPath } = await newSession(name);
    return { success: true, sessionId: id, sessionPath };
  } catch (err: any) {
    logger.error('[agent:newSession] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:renameSession', async (_event, sessionPath: string, name: string) => {
  try {
    await renameSession(sessionPath, name);
    return { success: true };
  } catch (err: any) {
    logger.error('[agent:renameSession] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:deleteSession', async (_event, sessionPath: string) => {
  try {
    await deleteSession(sessionPath);
    return { success: true };
  } catch (err: any) {
    logger.error('[agent:deleteSession] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle(
  'agent:exportSession',
  async (_event, sessionPath: string, format: 'html' | 'jsonl') => {
    try {
      const { join: pjoin, dirname } = await import('path');
      const outDir = dirname(sessionPath);
      const outPath = pjoin(outDir, `export-${Date.now()}.${format === 'html' ? 'html' : 'jsonl'}`);
      await exportSession(sessionPath, format, outPath);
      return { success: true, path: outPath };
    } catch (err: any) {
      logger.error('[agent:exportSession] error:', err);
      return { success: false, error: String(err) };
    }
  }
);

ipcMain.handle('agent:getCurrentCwd', async () => {
  try {
    return getActiveCwd();
  } catch {
    return '';
  }
});

ipcMain.handle('agent:getConfig', async () => {
  try {
    await ensureProvidersLoaded();
    const providers = getProviders() ?? [];
    // Read model from settings.json directly (no active session needed)
    const { readFileSync } = await import('fs');
    const settingsPath = join(getAgentDir(), 'settings.json');
    let currentModel: string | null = null;
    try {
      const raw = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      if (settings.defaultModel) {
        currentModel = `${settings.defaultProvider ?? 'minimax-cn'}/${settings.defaultModel}`;
      }
    } catch {}
    return { providers, currentModel };
  } catch (err) {
    console.error('[getConfig] error:', err);
    return { providers: [], currentModel: null, error: String(err) };
  }
});

ipcMain.handle('agent:getProviders', async () => {
  try {
    await ensureProvidersLoaded();
    const providers = getProviders() ?? [];
    return providers.map(p => ({
      id: p,
      hasApiKey: checkApiKeyConfigured(p),
    }));
  } catch (err) {
    logger.error('agent:getProviders failed', { err });
    return [];
  }
});

ipcMain.handle('agent:getModels', async (_event, provider: string) => {
  try {
    const models = getModels(provider) ?? [];
    return models.map(m => ({ id: m.id, provider: m.provider }));
  } catch (err) {
    logger.error('agent:getModels failed', { err });
    return [];
  }
});

ipcMain.handle('agent:setModel', async (_event, model: any) => {
  try {
    await setModel(model);
    logger.info('Model changed via IPC', { modelId: model.id });
    return { success: true };
  } catch (err) {
    logger.error('agent:setModel failed', { err });
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:saveApiKey', async (_event, provider: string, apiKey: string) => {
  const ok = saveApiKey(provider, apiKey);
  if (ok) {
    await reloadProviders();
  }
  return { success: ok };
});

ipcMain.handle('agent:removeApiKey', async (_event, provider: string) => {
  removeApiKey(provider);
  await reloadProviders();
  return { success: true };
});

ipcMain.handle('agent:isFirstRun', async () => {
  return isFirstRun();
});

ipcMain.handle('agent:reloadProviders', async () => {
  try {
    const providers = await reloadProviders();
    return { success: true, providers };
  } catch (err) {
    logger.error('agent:reloadProviders failed', { err });
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:abort', async () => {
  try {
    abort();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:getContextUsage', async () => {
  try {
    return getContextUsage() ?? null;
  } catch (err) {
    logger.error('agent:getContextUsage failed', { err });
    return null;
  }
});

ipcMain.handle('agent:compact', async (_event, instructions?: string) => {
  try {
    const result = await compact(instructions);
    return { success: true, summary: result.summary };
  } catch (err) {
    logger.error('agent:compact failed', { err });
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:setAutoCompaction', async (_event, enabled: boolean) => {
  try {
    setAutoCompaction(enabled);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:getAutoCompaction', async () => {
  try {
    const session = getAgentSession();
    return session.autoCompactionEnabled;
  } catch {
    return true;
  }
});

ipcMain.handle('agent:isCompacting', async () => {
  try {
    const session = getAgentSession();
    return session.isCompacting;
  } catch {
    return false;
  }
});

ipcMain.handle('agent:getSessionStats', async () => {
  try {
    const session = getAgentSession();
    return session.getSessionStats();
  } catch (err) {
    logger.error('agent:getSessionStats failed', { err });
    return null;
  }
});

ipcMain.handle('agent:getThinkingLevel', async () => {
  try {
    const session = getAgentSession();
    return {
      level: session.thinkingLevel,
      supportsThinking: session.supportsThinking(),
      availableLevels: session.getAvailableThinkingLevels(),
    };
  } catch (err) {
    return { level: 'none', supportsThinking: false, availableLevels: [] };
  }
});

ipcMain.handle('agent:setThinkingLevel', async (_event, level: string) => {
  try {
    const session = getAgentSession();
    session.setThinkingLevel(level as any);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:cycleThinkingLevel', async () => {
  try {
    const session = getAgentSession();
    const newLevel = session.cycleThinkingLevel();
    return { success: true, level: newLevel };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('agent:selectDirectory', async () => {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择项目目录',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('agent:getAgentHome', async () => {
  return getAgentDir();
});

// ─── Project Management ───────────────────────────────────────────────────

ipcMain.handle('agent:listProjects', async () => {
  try {
    return listProjects();
  } catch (err: any) {
    logger.error('[agent:listProjects] error:', err);
    return [];
  }
});

ipcMain.handle('agent:activateProject', async (_event, projectPath: string) => {
  try {
    await activateProject(projectPath);
    return { success: true };
  } catch (err: any) {
    logger.error('[agent:activateProject] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:deleteProject', async (_event, projectPath: string) => {
  try {
    unregisterProject(projectPath);
    return { success: true };
  } catch (err: any) {
    logger.error('[agent:deleteProject] error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('agent:renameProject', async (_event, projectPath: string, newName: string) => {
  try {
    renameProjectByPath(projectPath, newName);
    return { success: true };
  } catch (err: any) {
    logger.error('[agent:renameProject] error:', err);
    return { success: false, error: String(err) };
  }
});

// ─── App lifecycle ───────────────────────────────────────────────────────────

// WSL headless: use ozone platform and disable GPU
process.env.ELECTRON_OZONE_PLATFORM_HINT = '1';

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  logger.info('CodeAgent Electron starting...');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', err => {
  logger.error('Uncaught exception in Electron main', { err });
});

process.on('unhandledRejection', reason => {
  logger.error('Unhandled rejection in Electron main', { reason });
});
