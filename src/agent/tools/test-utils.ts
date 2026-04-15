/**
 * Shared test utilities for Agent tools tests.
 *
 * Provides mock factories for:
 * - node:child_process (exec/execFile)
 * - node:fs and node:fs/promises
 *
 * Usage:
 *   import { createMockExec, createMockFs } from './test-utils.js';
 *   vi.mock('node:child_process', () => ({ execAsync, execFileAsync, ... }))
 */

import { vi } from 'vitest';

// ─── exec/execFile Mock Factory ────────────────────────────────────────────────

export interface MockExecOptions {
  stdout?: string;
  stderr?: string;
  error?: Error & { killed?: boolean; signal?: string };
  timedOut?: boolean;
}

export function createMockExec(options: MockExecOptions = {}) {
  const { stdout = '', stderr = '', error, timedOut = false } = options;

  return vi.fn().mockImplementation(async (_command: string, _opts?: { timeout?: number; maxBuffer?: number }) => {
    if (timedOut) {
      const err = new Error('Command timed out') as Error & { timedOut: boolean; killed: boolean; signal: string };
      err.timedOut = true;
      err.killed = false;
      err.signal = 'SIGTERM';
      throw err;
    }
    if (error) {
      const err = Object.assign(new Error(error.message), error);
      throw err;
    }
    return { stdout, stderr };
  });
}

export function createMockExecFile(options: MockExecOptions = {}) {
  const { stdout = '', stderr = '', error, timedOut = false } = options;

  return vi.fn().mockImplementation(async (_cmd: string, _args?: string[], _opts?: { timeout?: number; maxBuffer?: number }) => {
    if (timedOut) {
      const err = new Error('Command timed out') as Error & { timedOut: boolean; killed: boolean; signal: string };
      err.timedOut = true;
      err.killed = false;
      err.signal = 'SIGTERM';
      throw err;
    }
    if (error) {
      const err = Object.assign(new Error(error.message), error);
      throw err;
    }
    return { stdout, stderr };
  });
}

// ─── fs Mock Factory ──────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
}

export interface MockFsOptions {
  /** Files that exist (name → content). Directories not needed in this map. */
  files?: Record<string, string>;
  /** Directories that exist (name → children). */
  directories?: Record<string, FileEntry[]>;
  /** stat() error — keyed by exact resolved path */
  statErrors?: Record<string, Error>;
  /** readdir() error */
  readdirErrors?: Record<string, Error>;
  /** readFile() error */
  readFileErrors?: Record<string, Error>;
  /** writeFile() error */
  writeFileErrors?: Record<string, Error>;
  /** mkdir() error */
  mkdirErrors?: Record<string, Error>;
}

export function createMockFs(options: MockFsOptions = {}) {
  const {
    files = {},
    directories = {},
    statErrors = {},
    readdirErrors = {},
    readFileErrors = {},
    writeFileErrors = {},
    mkdirErrors = {},
  } = options;

  const mockFs = {
    stat: vi.fn().mockImplementation(async (filePath: string) => {
      if (statErrors[filePath]) throw statErrors[filePath];
      if (files[filePath] !== undefined) {
        return { size: files[filePath].length, isFile: () => true, isDirectory: () => false };
      }
      // Check if it's a directory path
      for (const [, children] of Object.entries(directories)) {
        const found = children.find(f => f.name === filePath.split('/').pop());
        if (found?.isDirectory()) {
          return { size: 0, isFile: () => false, isDirectory: () => true };
        }
      }
      const err = new Error(`ENOENT: no such file or directory, stat '${filePath}'`) as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    }),

    readFile: vi.fn().mockImplementation(async (filePath: string) => {
      if (readFileErrors[filePath]) throw readFileErrors[filePath];
      if (files[filePath] !== undefined) return files[filePath];
      const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    }),

    readdir: vi.fn().mockImplementation(async (dirPath: string, _opts?: { withFileTypes?: boolean }) => {
      if (readdirErrors[dirPath]) throw readdirErrors[dirPath];
      if (directories[dirPath]) return directories[dirPath];
      // Handle children of known directories
      for (const [parent, children] of Object.entries(directories)) {
        const childDir = parent.split('/').pop();
        if (dirPath.endsWith(childDir!)) {
          return children;
        }
      }
      const err = new Error(`ENOENT: no such file or directory, readdir '${dirPath}'`) as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    }),

    writeFile: vi.fn().mockImplementation(async (filePath: string, _content: string) => {
      if (writeFileErrors[filePath]) throw writeFileErrors[filePath];
      files[filePath] = _content;
    }),

    mkdir: vi.fn().mockImplementation(async (dirPath: string) => {
      if (mkdirErrors[dirPath]) throw mkdirErrors[dirPath];
      // Auto-create the directory in our mock
      if (!directories[dirPath]) {
        directories[dirPath] = [];
      }
    }),
  };

  return { mockFs, files, directories };
}

// ─── Re-export vitest for convenience ─────────────────────────────────────────
export { vi };
