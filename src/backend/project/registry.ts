/**
 * Project Registry — manages the list of registered projects.
 *
 * Stored in `~/.pi/agent/projects.json`:
 * {
 *   "projects": [
 *     { "path": "D:\\work\\project\\Foo", "name": "Foo", "createdAt": 1234567890 },
 *     ...
 *   ]
 * }
 *
 * Each project has independent AgentSessions. Session files are created
 * lazily on first prompt, not at project creation time.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getAgentDir } from '@mariozechner/pi-coding-agent';
import { logger } from '../logger.js';

export interface ProjectInfo {
  path: string; // absolute directory path
  name: string; // display name (basename of path)
  createdAt: number; // Unix timestamp ms
}

interface ProjectsFile {
  projects: ProjectInfo[];
}

function getProjectsPath(): string {
  return join(getAgentDir(), 'projects.json');
}

function readProjects(): ProjectsFile {
  const path = getProjectsPath();
  if (!existsSync(path)) {
    return { projects: [] };
  }
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as ProjectsFile;
  } catch (err) {
    logger.error('[Projects] Failed to read projects.json:', err);
    return { projects: [] };
  }
}

function writeProjects(data: ProjectsFile): void {
  const agentDir = getAgentDir();
  if (!existsSync(agentDir)) {
    mkdirSync(agentDir, { recursive: true });
  }
  const path = getProjectsPath();
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * List all registered projects.
 */
export function listProjects(): ProjectInfo[] {
  return readProjects().projects;
}

/**
 * Get a single project by path.
 */
export function getProject(path: string): ProjectInfo | undefined {
  return readProjects().projects.find(p => p.path === path);
}

/**
 * Register a new project. Returns the new project entry.
 * Does NOT create a session — sessions are created lazily on first prompt.
 */
export function addProject(targetPath: string, name?: string): ProjectInfo {
  const data = readProjects();

  // Avoid duplicates
  const existing = data.projects.find(p => p.path === targetPath);
  if (existing) {
    return existing;
  }

  const project: ProjectInfo = {
    path: targetPath,
    name: name || targetPath.split(/[\\/\\\\]/).pop() || '(无项目)',
    createdAt: Date.now(),
  };

  data.projects.push(project);
  writeProjects(data);
  logger.info('[Projects] Registered project:', project.path, '->', project.name);

  return project;
}

/**
 * Remove a project from the registry.
 * Does NOT delete any session files.
 */
export function removeProject(path: string): void {
  const data = readProjects();
  const idx = data.projects.findIndex(p => p.path === path);
  if (idx !== -1) {
    data.projects.splice(idx, 1);
    writeProjects(data);
    logger.info('[Projects] Removed project:', path);
  }
}

/**
 * Rename a project (updates the display name only).
 */
export function renameProject(path: string, newName: string): void {
  const data = readProjects();
  const project = data.projects.find(p => p.path === path);
  if (project) {
    project.name = newName;
    writeProjects(data);
    logger.info('[Projects] Renamed project:', path, '->', newName);
  }
}

/**
 * Get or create the "default" project (Electron process's cwd).
 * Used when no project has been selected yet.
 */
export function getOrCreateDefaultProject(): ProjectInfo {
  const data = readProjects();
  const defaultPath = process.cwd();

  let project = data.projects.find(p => p.path === defaultPath);
  if (!project) {
    project = {
      path: defaultPath,
      name: defaultPath.split(/[\\/\\\\]/).pop() || 'Default',
      createdAt: Date.now(),
    };
    data.projects.push(project);
    writeProjects(data);
    logger.info('[Projects] Created default project:', project.path);
  }

  return project;
}
