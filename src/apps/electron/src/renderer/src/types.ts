/**
 * Window.agent 类型定义 - 与 preload 一一对应
 */

export interface InitResult {
  success: boolean;
  sessionId?: string | null;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage?: string;
}

export interface Project {
  path: string;
  name: string;
  createdAt: number;
}

export interface SessionGroup {
  global: Session[];
  byProject: Record<string, Session[]>;
}

export interface Provider {
  id: string;
  name?: string;
  hasApiKey: boolean;
}

export interface Model {
  id: string;
  provider: string;
}

export interface ThinkingLevel {
  level: string;
  supportsThinking: boolean;
  availableLevels: string[];
}

export interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export interface SelectDirectoryResult {
  success: boolean;
  path?: string;
  canceled?: boolean;
}

export interface SessionGroup {
  global: Session[];
  byProject: Record<string, Session[]>;
}

export interface AgentAPI {
  // Init
  init(): Promise<InitResult>;

  // Session
  hasActiveSession(): Promise<boolean>;
  prompt(text: string): Promise<{ success: boolean; error?: string }>;
  getMessages(): Promise<Message[]>;
  getSessionId(): Promise<string>;
  listSessions(): Promise<Session[]>;
  listSessionGroups(): Promise<SessionGroup>;
  newSession(name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string }>;
  newGlobalSession(name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string }>;
  newSessionForProject(cwd: string, name?: string): Promise<{ success: boolean; sessionId?: string; sessionPath?: string }>;
  switchSession(path: string, cwd: string): Promise<{ success: boolean; error?: string }>;
  deleteSession(path: string): Promise<{ success: boolean; error?: string }>;
  renameSession(path: string, name: string): Promise<{ success: boolean; error?: string }>;

  // Project
  listProjects(): Promise<Project[]>;
  activateProject(path: string): Promise<{ success: boolean; error?: string }>;
  deleteProject(path: string): Promise<{ success: boolean; error?: string }>;
  renameProject(path: string, newName: string): Promise<{ success: boolean; error?: string }>;
  selectDirectory(): Promise<SelectDirectoryResult>;

  // Model
  getConfig(): Promise<{ providers: Provider[]; currentModel: string | null }>;
  getProviders(): Promise<Provider[]>;
  getModels(provider: string): Promise<Model[]>;
  setModel(model: { id: string; provider?: string }): Promise<{ success: boolean; error?: string }>;
  saveApiKey(provider: string, key: string): Promise<{ success: boolean; error?: string }>;
  removeApiKey(provider: string): Promise<{ success: boolean; error?: string }>;
  isFirstRun(): Promise<boolean>;
  reloadProviders(): Promise<{ success: boolean; providers?: string[]; error?: string }>;

  // Context
  getContextUsage(): Promise<ContextUsage>;
  compact(instructions?: string): Promise<{ success: boolean; summary?: string; error?: string }>;
  setAutoCompaction(enabled: boolean): Promise<{ success: boolean; error?: string }>;
  getAutoCompaction(): Promise<boolean>;
  isCompacting(): Promise<boolean>;

  // Stats
  getSessionStats(): Promise<any>;
  getThinkingLevel(): Promise<ThinkingLevel>;
  setThinkingLevel(level: string): void;
  cycleThinkingLevel(): Promise<{ success: boolean; level?: string; error?: string }>;

  // Control
  abort(): Promise<{ success: boolean }>;

  // Events
  onEvent(callback: (event: any) => void): () => void;

  // Utils
  getCurrentCwd(): Promise<string>;
  getAgentHome(): Promise<string>;
}

export interface ShellAPI {
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    agent: AgentAPI;
    shell: ShellAPI;
  }
}