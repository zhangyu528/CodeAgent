/**
 * Shared Constants for CodeAgent Agent Module
 *
 * Centralizes path and version constants used across sessions.ts and
 * sessionRepository.ts to avoid duplication and ensure consistency.
 */

import path from 'path';
import os from 'os';

// ─── Path Constants ────────────────────────────────────────────────────────────

/** Root configuration directory for CodeAgent */
export const CONFIG_DIR = path.join(os.homedir(), '.codeagent');

/** Directory for session storage files */
export const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');

// ─── Session Schema Version ────────────────────────────────────────────────────

/** Current session document schema version */
export const SESSION_VERSION = 1;

// ─── Memory Protection ─────────────────────────────────────────────────────────

/** Maximum messages to load from a single session to prevent unbounded memory consumption */
export const MAX_MESSAGES = 10000;