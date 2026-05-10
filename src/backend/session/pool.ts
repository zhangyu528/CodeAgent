/**
 * Agent - Session Pool with Lazy Session Creation
 *
 * Architecture:
 * - Project registry: projects.json (list of project directories)
 * - Session files: created LAZILY on first prompt, not at project creation
 * - Session Pool: one AgentSession per active project (cached in memory)
 * - Active project: tracked separately from active session
 *
 * Design goals:
 * - "New Project" only registers the directory — no session file created
 * - Session is created on first prompt (lazy)
 * - Each project has its own tools bound to its cwd
 * - Switching projects = switching the active project, session is restored on next prompt
 */
import {
  createAgentSession,
  AgentSession,
  codingTools,
  findTool,
  grepTool,
  lsTool,
} from '@mariozechner/pi-coding-agent';
import { logger } from '../logger.js';
import { getAuthStorage } from '../auth/index.js';
import { getModelRegistry } from '../model/index.js';
import { getSettingsManager } from '../model/index.js';
import { getAgentDir } from '@mariozechner/pi-coding-agent';
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';
import { join } from 'path';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import {
  listProjects,
  addProject,
  removeProject,
  renameProject,
  getOrCreateDefaultProject,
  type ProjectInfo,
} from '../project/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PooledSession {
  session: AgentSession;
  projectCwd: string;
  sessionFile: string;
}

export interface SessionInfo {
  id: string;
  path: string;
  cwd: string;
  name: string | undefined;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
}

// ============================================================================
// Session Pool
// ============================================================================

const _pool = new Map<string, PooledSession>(); // key = projectCwd (one session per project)
let _activeProjectPath: string | null = null;
let _activeSessionFile: string | null = null;

/**
 * Lazily create (or retrieve from pool) an AgentSession for a project.
 * Creates the session file if it doesn't exist.
 */
async function getOrCreateSessionForProject(projectCwd: string): Promise<PooledSession> {
  if (_pool.has(projectCwd)) {
    return _pool.get(projectCwd)!;
  }

  // Find the most recent session for this project, or create a new one
  const sessionFile = await getOrCreateSessionFile(projectCwd);
  logger.info('[SessionPool] Creating AgentSession for project:', projectCwd, 'file:', sessionFile);

  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const sessionManager = SessionManager.open(sessionFile);

  const { session, modelFallbackMessage } = await createAgentSession({
    agentDir: getAgentDir(),
    authStorage: getAuthStorage(),
    modelRegistry: getModelRegistry(),
    settingsManager: getSettingsManager(),
    sessionManager,
    tools: [...codingTools, findTool, grepTool, lsTool],
    cwd: projectCwd,
  });

  if (modelFallbackMessage) {
    logger.warn('[SessionPool] Model fallback:', modelFallbackMessage);
  }

  const pooled: PooledSession = { session, projectCwd, sessionFile };
  _pool.set(projectCwd, pooled);
  return pooled;
}

/**
 * Find the most recent session file for a project, or create a new session file.
 */
async function getOrCreateSessionFile(projectCwd: string): Promise<string> {
  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const allSessions = await SessionManager.listAll();
  const projectSessions = allSessions
    .filter(s => s.cwd === projectCwd)
    .sort((a, b) => b.modified.getTime() - a.modified.getTime());

  if (projectSessions.length > 0) {
    return projectSessions[0].path;
  }

  // No session exists for this project — create one
  return createSessionFile(projectCwd);
}

function createSessionFile(projectCwd: string): string {
  const sessionDir = joinSessionDir(projectCwd);
  mkdirSync(sessionDir, { recursive: true });

  const timestamp = Date.now();
  const shortId = Math.random().toString(16).slice(2, 10);
  const sessionFile = join(sessionDir, `${timestamp}_${shortId}.jsonl`);
  const projectName = projectCwd ? projectCwd.split(/[\\/]/).pop()! : 'Global';

  appendFileSync(
    sessionFile,
    JSON.stringify({
      id: `${timestamp}_${shortId}`,
      type: 'session',
      version: 2,
      timestamp,
      name: projectName,
      cwd: projectCwd,
    }) + '\n'
  );

  logger.info('[Agent] Created session file:', sessionFile, 'cwd:', projectCwd);
  return sessionFile;
}

function joinSessionDir(cwd: string): string {
  if (!cwd) {
    // Global sessions (no project) go to sessions/__global__/
    return join(getAgentDir(), 'sessions', '__global__');
  }
  const safe = cwd.replace(/^[\\/]/, '').replace(/[\\/:]/g, '-');
  return join(getAgentDir(), 'sessions', `--${safe}--`);
}

// ============================================================================
// Initialization
// ============================================================================

let _initialized = false;
let _initPromise: Promise<void> | null = null;

/**
 * Bootstrap: load project registry, restore last active project.
 * Does NOT create a session — sessions are created lazily on first prompt.
 * Does NOT auto-create a default project — allows null (global-only) state.
 */
export async function ensureAgentInitialized(): Promise<void> {
  if (_initialized) return;
  if (!_initPromise) {
    _initPromise = (async () => {
      logger.info('[Agent] Initializing...');
      // Don't auto-create a default project — allow _activeProjectPath = null
      // so "global sessions only" mode is possible
      _initialized = true;
    })();
  }
  return _initPromise;
}

// ============================================================================
// Active Project Management
// ============================================================================

/**
 * Get the currently active project path.
 */
export function getActiveProjectPath(): string {
  if (!_activeProjectPath) {
    throw new Error('[Agent] No active project. Call ensureAgentInitialized() first.');
  }
  return _activeProjectPath;
}

/**
 * Activate a project (switch sidebar to show it).
 * If the project has no session yet, none is activated — renderer shows
 * the "start chatting" state. Session is created lazily on first prompt.
 */
export async function activateProject(projectPath: string): Promise<void> {
  await ensureAgentInitialized();

  const projects = listProjects();
  const project = projects.find(p => p.path === projectPath);
  if (!project) {
    throw new Error('[Agent] Project not found: ' + projectPath);
  }

  _activeProjectPath = projectPath;
  _activeSessionFile = null; // no active session until prompt
  logger.info('[Agent] Activated project:', projectPath);
}

/**
 * Ensure the active project has an active session (create lazily if needed).
 * Called by prompt() before sending the first message.
 */
async function ensureActiveSession(): Promise<PooledSession> {
  await ensureAgentInitialized();

  const projectPath = _activeProjectPath!;

  // If we already have an active session for this project, return it
  if (_activeSessionFile && _pool.has(projectPath)) {
    return _pool.get(projectPath)!;
  }

  // Create (or restore) session for this project
  const pooled = await getOrCreateSessionForProject(projectPath);
  _activeSessionFile = pooled.sessionFile;
  return pooled;
}

// ============================================================================
// Session Operations (delegated to active session)
// ============================================================================

export function getAgent() {
  return getAgentSession().agent;
}

export function getSessionId(): string {
  return getAgentSession().sessionId;
}

export function getSessionName(): string | undefined {
  return getAgentSession().sessionName;
}

export function setSessionName(name: string): void {
  const sessionFile = getAgentSession().sessionFile;
  if (sessionFile) {
    void renameSession(sessionFile, name);
  }
}

export function getSessionFile(): string | undefined {
  return getAgentSession().sessionFile;
}

export function getSessionMessages(): any[] {
  return getAgentSession().messages as any[];
}

export function getContextUsage() {
  try {
    return getAgentSession().getContextUsage();
  } catch {
    return null;
  }
}

export async function setModel(model: any): Promise<void> {
  return getAgentSession().setModel(model);
}

export async function compact(instructions?: string) {
  return getAgentSession().compact(instructions);
}

export function setAutoCompaction(enabled: boolean): void {
  getAgentSession().setAutoCompactionEnabled(enabled);
}

export function abort(): void {
  getAgentSession().abort();
}

// ============================================================================
// Project & Session Management
// ============================================================================

export function getActiveCwd(): string {
  return _activeProjectPath ?? process.cwd();
}

/**
 * Register a new project (adds to projects.json).
 * Does NOT create a session — session is created lazily on first prompt.
 */
export function registerProject(targetPath: string, name?: string): ProjectInfo {
  const project = addProject(targetPath, name);
  return project;
}

/**
 * Remove a project from the registry.
 * Does NOT delete any session files.
 */
export function unregisterProject(path: string): void {
  removeProject(path);
  if (_activeProjectPath === path) {
    _activeProjectPath = null;
    _activeSessionFile = null;
    _pool.delete(path);
  }
}

/**
 * Rename a project.
 */
export function renameProjectByPath(path: string, newName: string): void {
  renameProject(path, newName);
}

/**
 * Switch to a session within the active project.
 * Creates the session if it doesn't exist.
 */
export async function activateSession(sessionPath: string, _projectCwd: string): Promise<void> {
  // Update active project path when switching to a session from a different project
  _activeProjectPath = _projectCwd;
  const pooled = await getOrCreateSessionForProject(_projectCwd);
  if (pooled.sessionFile !== sessionPath) {
    // Switch to the specific session file using SDK's switchSession
    await pooled.session.switchSession(sessionPath);
    _activeSessionFile = sessionPath;
  } else {
    _activeSessionFile = pooled.sessionFile;
  }
}

/**
 * Create a new global session (no project) and activate it.
 * Used when user clicks "New Conversation" with no active project.
 */
export interface NewSessionResult {
  id: string;
  path: string;
}

export async function newGlobalSession(name?: string): Promise<NewSessionResult> {
  // Set global mode: empty string as project path
  _activeProjectPath = '';
  _activeSessionFile = null;

  const newSessionFile = createSessionFile('');
  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const sessionManager = SessionManager.open(newSessionFile);

  const { session, modelFallbackMessage } = await createAgentSession({
    agentDir: getAgentDir(),
    authStorage: getAuthStorage(),
    modelRegistry: getModelRegistry(),
    settingsManager: getSettingsManager(),
    sessionManager,
    tools: [...codingTools, findTool, grepTool, lsTool],
    cwd: '', // no project cwd
  });

  if (modelFallbackMessage) {
    logger.warn('[Agent] Global session model fallback:', modelFallbackMessage);
  }

  _pool.set('', { session, projectCwd: '', sessionFile: newSessionFile });
  _activeSessionFile = newSessionFile;

  const id = newSessionFile.split('/').pop()!.replace('.jsonl', '').split('_')[0];
  return { id: `${id}_${Math.random().toString(16).slice(2, 10)}`, path: newSessionFile };
}

/**
 * Create a new session in the CURRENT project and activate it.
 * Used by the sidebar project "+" button.
 * Requires _activeProjectPath to be set (project must be active).
 */
export async function newSession(name?: string): Promise<NewSessionResult> {
  const projectPath = _activeProjectPath;
  if (!projectPath) {
    throw new Error(
      '[Agent] No active project. Call activateProject() or newGlobalSession() first.'
    );
  }

  const newSessionFile = createSessionFile(projectPath);
  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const sessionManager = SessionManager.open(newSessionFile);

  const { session, modelFallbackMessage } = await createAgentSession({
    agentDir: getAgentDir(),
    authStorage: getAuthStorage(),
    modelRegistry: getModelRegistry(),
    settingsManager: getSettingsManager(),
    sessionManager,
    tools: [...codingTools, findTool, grepTool, lsTool],
    cwd: projectPath,
  });

  if (modelFallbackMessage) {
    logger.warn('[Agent] Model fallback:', modelFallbackMessage);
  }

  _pool.set(projectPath, { session, projectCwd: projectPath, sessionFile: newSessionFile });
  _activeSessionFile = newSessionFile;

  const id = newSessionFile.split('/').pop()!.replace('.jsonl', '').split('_')[0];
  return { id: `${id}_${Math.random().toString(16).slice(2, 10)}`, path: newSessionFile };
}

/**
 * Rename a session.
 */
export async function renameSession(sessionPath: string, name: string): Promise<void> {
  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const mgr = SessionManager.open(sessionPath);
  mgr.appendSessionInfo(name);
}

/**
 * Delete a session file.
 */
export async function deleteSession(sessionPath: string): Promise<void> {
  const { existsSync, unlinkSync } = await import('fs');
  if (!existsSync(sessionPath)) return;
  unlinkSync(sessionPath);

  // Remove from pool if it was cached
  const poolEntries = Array.from(_pool.entries());
  for (const [cwd, pooled] of poolEntries) {
    if (pooled.sessionFile === sessionPath) {
      _pool.delete(cwd);
      break;
    }
  }

  // If this was the active session, clear it
  if (_activeSessionFile === sessionPath) {
    _activeSessionFile = null;
  }
}

/**
 * Export session to HTML or JSONL.
 */
export async function exportSession(
  sessionPath: string,
  format: 'html' | 'jsonl',
  outputPath: string
): Promise<void> {
  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const sessionManager = SessionManager.open(sessionPath);
  // Create a temporary agent session just for export
  // Find pooled session by file path
  const pooledValues = Array.from(_pool.values());
  const pooled = pooledValues.find(p => p.sessionFile === sessionPath);
  if (pooled) {
    if (format === 'html') {
      await pooled.session.exportToHtml(outputPath);
    } else {
      pooled.session.exportToJsonl(outputPath);
    }
  }
}

/**
 * List all sessions across all projects.
 * Used by renderer to show session list grouped by project.
 */
export async function listAllSessions(): Promise<SessionInfo[]> {
  const { SessionManager } = await import('@mariozechner/pi-coding-agent');
  const all = await SessionManager.listAll();

  // Group sessions by their cwd, sort by modified desc within each group
  const byCwd = new Map<string, typeof all>();
  for (const s of all) {
    const cwd = s.cwd || '';
    if (!byCwd.has(cwd)) byCwd.set(cwd, []);
    byCwd.get(cwd)!.push(s);
  }

  const result: SessionInfo[] = [];
  const cwdEntries = Array.from(byCwd.entries());
  for (const [cwd, sessions] of cwdEntries) {
    const sorted = sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    for (const s of sorted) {
      result.push({
        id: s.id,
        path: s.path,
        cwd: s.cwd || cwd,
        name: s.name || undefined,
        created: s.created,
        modified: s.modified,
        messageCount: s.messageCount ?? 0,
        firstMessage: s.firstMessage || '',
      });
    }
  }

  return result;
}

// ============================================================================
// Prompt (with lazy session creation)
// ============================================================================

/**
 * Send a prompt — ensures an active session exists first (lazy creation).
 */
export async function prompt(promptText: string): Promise<void> {
  const pooled = await ensureActiveSession();
  await pooled.session.prompt(promptText);
}

// ============================================================================
// Event Subscription (for renderer)
// ============================================================================

/**
 * Subscribe to events from the active session.
 * The renderer calls this to start receiving agent events over IPC.
 */
export function subscribeToActiveSession(callback: (event: AgentSessionEvent) => void): () => void {
  if (!_activeSessionFile || !_activeProjectPath) {
    // No active session yet — return a no-op unsubscribe
    return () => {};
  }
  const pooled = _pool.get(_activeProjectPath);
  if (!pooled) {
    return () => {};
  }
  return pooled.session.subscribe(callback);
}

// ============================================================================
// Internal helpers
// ============================================================================

function projectCwdFromPath(sessionPath: string): string {
  const match = sessionPath.match(/[\\/]sessions[\\/](--[^\\/]+--)[\\/]/);
  if (!match) return process.cwd();
  const encoded = match[1];
  const inner = encoded.slice(2, -2);
  const parts = inner.split('--');
  if (parts[0].length === 1 && /[A-Za-z]/.test(parts[0])) {
    return parts[0] + ':\\' + parts.slice(1).join('\\');
  }
  return '/' + parts.join('/');
}

/**
 * Check if there is an active session.
 */
export function hasActiveSession(): boolean {
  if (!_activeSessionFile || !_activeProjectPath) return false;
  return _pool.has(_activeProjectPath);
}

/**
 * Get the active AgentSession (must have an active session).
 */
export function getAgentSession(): AgentSession {
  if (!_activeSessionFile || !_activeProjectPath) {
    throw new Error('[Agent] No active session. Call activateProject() or prompt() first.');
  }
  const pooled = _pool.get(_activeProjectPath);
  if (!pooled) {
    throw new Error('[Agent] Active session not in pool.');
  }
  return pooled.session;
}
