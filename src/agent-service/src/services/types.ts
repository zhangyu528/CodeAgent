/**
 * Agent Service - Type Definitions
 */

import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent';

export interface Session {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: Date;
  modified: Date;
  messageCount: number;
}

export interface SessionGroup {
  global: Session[];
  byProject: Record<string, Session[]>;
}

export interface AgentService {
  init(): Promise<{ success: boolean; sessionId?: string | null; error?: string }>;
  hasActiveSession(): boolean;
  prompt(promptText: string): Promise<{ success: boolean; error?: string }>;
  getMessages(): any[];
  getSessionId(): string | null;
  listSessions(): Promise<Session[]>;
  listSessionGroups(): Promise<SessionGroup>;

  // Session management
  createSession(name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string; error?: string }>;
  createGlobalSession(name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string; error?: string }>;
  createSessionForProject(cwd: string, name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string; error?: string }>;
  switchSession(sessionPath: string, projectCwd: string): Promise<void>;
  deleteSession(sessionPath: string): Promise<void>;
  renameSession(sessionPath: string, newName: string): Promise<void>;

  // Project
  listProjects(): Promise<any[]>;
  activateProject(path: string): Promise<{ success: boolean; error?: string }>;
  deleteProject(path: string): Promise<void>;
  renameProject(path: string, newName: string): Promise<void>;
  getCurrentCwd(): Promise<string>;

  // Model
  getConfig(): Promise<any>;
  getProviders(): Promise<{ id: string; hasApiKey: boolean }[]>;
  getModels(provider: string): Promise<any[]>;
  setModel(model: { id: string; provider?: string }): Promise<void>;
  saveApiKey(provider: string, apiKey: string): Promise<{ success: boolean; error?: string }>;
  removeApiKey(provider: string): Promise<{ success: boolean; error?: string }>;
  isFirstRun(): Promise<boolean>;
  reloadProviders(): Promise<{ success: boolean; providers?: string[]; error?: string }>;

  // Context
  getContextUsage(): any;
  compact(instructions?: string): Promise<{ success: boolean; summary?: string; error?: string }>;
  setAutoCompaction(enabled: boolean): Promise<{ success: boolean; error?: string }>;
  getAutoCompaction(): Promise<boolean>;
  isCompacting(): Promise<boolean>;

  // Stats
  getSessionStats(): any;
  getThinkingLevel(): Promise<{ level: string; supportsThinking: boolean; availableLevels: string[] }>;
  setThinkingLevel(level: string): void;
  cycleThinkingLevel(): Promise<{ success: boolean; level?: string; error?: string }>;

  // Control
  abort(): void;

  // Events
  onEvent(callback: (event: AgentSessionEvent) => void): () => void;

  // Platform-specific (handled in Electron main.ts)
  getAgentHome(): Promise<string>;
}