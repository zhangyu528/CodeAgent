import { beforeAll, afterAll, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import {
  TEST_AGENT_DIR,
  GLOBAL_DIR,
  PROJECT_DIR,
  PROJECT_DIR_2,
  GLOBAL_SESSION_FILE,
  PROJECT_SESSION_FILE,
  GLOBAL_SESSION_HEADER,
  PROJECT_SESSION_HEADER,
  SAMPLE_MESSAGES,
} from './__fixtures__/sessions.js';

// Set agent directory before all tests
process.env.AGENT_DIR = TEST_AGENT_DIR;

beforeAll(() => {
  // Create test directories
  mkdirSync(GLOBAL_DIR, { recursive: true });
  mkdirSync(PROJECT_DIR, { recursive: true });
  mkdirSync(PROJECT_DIR_2, { recursive: true });

  // Create session files
  const globalContent = [
    JSON.stringify(GLOBAL_SESSION_HEADER),
    ...SAMPLE_MESSAGES.map(m => JSON.stringify(m)),
  ].join('\n') + '\n';
  writeFileSync(GLOBAL_SESSION_FILE, globalContent);

  const projectContent = [
    JSON.stringify(PROJECT_SESSION_HEADER),
    ...SAMPLE_MESSAGES.map(m => JSON.stringify(m)),
  ].join('\n') + '\n';
  writeFileSync(PROJECT_SESSION_FILE, projectContent);
});

afterAll(() => {
  // Clean up test directories
  try {
    rmSync(TEST_AGENT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

afterEach(() => {
  // Reset all mocks after each test
  vi.clearAllMocks();
});