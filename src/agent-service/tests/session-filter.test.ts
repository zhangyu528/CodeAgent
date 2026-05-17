import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'fs';

// Test data paths
const TEST_AGENT_DIR = join(tmpdir(), 'codeagent-test-' + Date.now());
const SESSIONS_DIR = join(TEST_AGENT_DIR, 'sessions');
const GLOBAL_DIR = join(SESSIONS_DIR, '__global__');
const PROJECT_DIR = join(SESSIONS_DIR, '--D--work-project-Test--');

// Helper function that mimics the actual filter logic in listAllSessions
function filterValidSessions(sessions: { path: string; cwd?: string }[]) {
  return sessions.filter(s => {
    if (!s.path || typeof s.path !== 'string') return false;
    if (!s.path.endsWith('.jsonl')) return false;
    return true;
  });
}

// Helper to group sessions like listSessionGroups does
function groupSessions(sessions: { path: string; cwd?: string }[]) {
  const groups: { global: any[]; byProject: Record<string, any[]> } = { global: [], byProject: {} };
  for (const s of sessions) {
    if (!s.cwd) {
      groups.global.push(s);
    } else {
      if (!groups.byProject[s.cwd]) {
        groups.byProject[s.cwd] = [];
      }
      groups.byProject[s.cwd].push(s);
    }
  }
  return groups;
}

// Setup test directories
beforeAll(() => {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  mkdirSync(PROJECT_DIR, { recursive: true });

  // Create valid session files
  writeFileSync(join(GLOBAL_DIR, '1778830744809_test123.jsonl'),
    '{"id":"test123","type":"session","version":2,"timestamp":1778830744809,"name":"Test Global","cwd":""}\n');
  writeFileSync(join(PROJECT_DIR, '1778830744809_test456.jsonl'),
    '{"id":"test456","type":"session","version":2,"timestamp":1778830744809,"name":"Test Project","cwd":"D:\\\\work\\\\project\\\\Test"}\n');
});

// Cleanup after tests
afterAll(() => {
  try {
    rmSync(TEST_AGENT_DIR, { recursive: true, force: true });
  } catch {}
});

describe('Session Path Filter Logic', () => {
  test('valid .jsonl paths pass the filter', () => {
    const validSessions = [
      { path: join(GLOBAL_DIR, '1778830744809_test123.jsonl'), cwd: '' },
      { path: join(PROJECT_DIR, '1778830744809_test456.jsonl'), cwd: 'D:\\work\\project\\Test' },
    ];

    const filtered = filterValidSessions(validSessions);
    expect(filtered.length).toBe(2);
  });

  test('directory paths are filtered out', () => {
    const mixedSessions = [
      { path: join(GLOBAL_DIR, '1778830744809_test123.jsonl'), cwd: '' },
      { path: GLOBAL_DIR },  // This is a directory, not a file
      { path: PROJECT_DIR }, // This is a directory, not a file
    ];

    const filtered = filterValidSessions(mixedSessions);
    expect(filtered.length).toBe(1);
    expect(filtered[0].path.endsWith('.jsonl')).toBe(true);
  });

  test('paths without .jsonl extension are filtered out', () => {
    const mixedSessions = [
      { path: join(GLOBAL_DIR, '1778830744809_test123.jsonl'), cwd: '' },
      { path: 'D:\\work\\project\\CodeAgent' },  // Project path, not a session file
    ];

    const filtered = filterValidSessions(mixedSessions);
    expect(filtered.length).toBe(1);
  });
});

describe('Session Grouping Logic', () => {
  test('sessions with empty cwd are grouped as global', () => {
    const sessions = [
      { path: join(GLOBAL_DIR, '1778830744809_test123.jsonl'), cwd: '' },
      { path: join(PROJECT_DIR, '1778830744809_test456.jsonl'), cwd: 'D:\\work\\project\\Test' },
    ];

    const groups = groupSessions(sessions);
    expect(groups.global.length).toBe(1);
    expect(groups.global[0].cwd).toBe('');
  });

  test('sessions with non-empty cwd are grouped by project', () => {
    const sessions = [
      { path: join(GLOBAL_DIR, '1778830744809_test123.jsonl'), cwd: '' },
      { path: join(PROJECT_DIR, '1778830744809_test456.jsonl'), cwd: 'D:\\work\\project\\Test' },
    ];

    const groups = groupSessions(sessions);
    expect(Object.keys(groups.byProject).length).toBe(1);
    expect(groups.byProject['D:\\work\\project\\Test']).toBeDefined();
    expect(groups.byProject['D:\\work\\project\\Test'].length).toBe(1);
  });

  test('global sessions have empty string cwd', () => {
    const sessions = [
      { path: join(GLOBAL_DIR, '1778830744809_test123.jsonl'), cwd: '' },
    ];

    const groups = groupSessions(sessions);
    expect(groups.global[0].cwd).toBe('');
  });
});

describe('Real Session Files', () => {
  test('created test session files exist and have .jsonl extension', () => {
    expect(existsSync(join(GLOBAL_DIR, '1778830744809_test123.jsonl'))).toBe(true);
    expect(existsSync(join(PROJECT_DIR, '1778830744809_test456.jsonl'))).toBe(true);
  });

  test('created test session files are actual files (not directories)', () => {
    const globalStat = statSync(join(GLOBAL_DIR, '1778830744809_test123.jsonl'));
    const projectStat = statSync(join(PROJECT_DIR, '1778830744809_test456.jsonl'));

    expect(globalStat.isFile()).toBe(true);
    expect(projectStat.isFile()).toBe(true);
  });

  test('directories are not files', () => {
    const globalDirStat = statSync(GLOBAL_DIR);
    const projectDirStat = statSync(PROJECT_DIR);

    expect(globalDirStat.isDirectory()).toBe(true);
    expect(projectDirStat.isDirectory()).toBe(true);
    expect(globalDirStat.isFile()).toBe(false);
  });
});