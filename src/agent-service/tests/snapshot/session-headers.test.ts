import { describe, test, expect } from 'vitest';
import { GLOBAL_SESSION_HEADER, PROJECT_SESSION_HEADER } from '../__fixtures__/sessions.js';

/**
 * @group snapshot
 */
describe('Session Headers - Snapshot Test', () => {
  test('GLOBAL_SESSION_HEADER structure', () => {
    expect(GLOBAL_SESSION_HEADER).toEqual({
      id: expect.any(String),
      type: 'session',
      version: 2,
      timestamp: expect.any(Number),
      name: expect.any(String),
      cwd: '',
    });
  });

  test('PROJECT_SESSION_HEADER structure', () => {
    expect(PROJECT_SESSION_HEADER).toEqual({
      id: expect.any(String),
      type: 'session',
      version: 2,
      timestamp: expect.any(Number),
      name: expect.any(String),
      cwd: expect.any(String),
    });
  });

  test('GLOBAL_SESSION_HEADER has required fields', () => {
    expect(GLOBAL_SESSION_HEADER).toHaveProperty('id');
    expect(GLOBAL_SESSION_HEADER).toHaveProperty('type', 'session');
    expect(GLOBAL_SESSION_HEADER).toHaveProperty('version', 2);
    expect(GLOBAL_SESSION_HEADER).toHaveProperty('timestamp');
    expect(GLOBAL_SESSION_HEADER).toHaveProperty('name');
    expect(GLOBAL_SESSION_HEADER).toHaveProperty('cwd', '');
  });

  test('PROJECT_SESSION_HEADER has required fields', () => {
    expect(PROJECT_SESSION_HEADER).toHaveProperty('id');
    expect(PROJECT_SESSION_HEADER).toHaveProperty('type', 'session');
    expect(PROJECT_SESSION_HEADER).toHaveProperty('version', 2);
    expect(PROJECT_SESSION_HEADER).toHaveProperty('timestamp');
    expect(PROJECT_SESSION_HEADER).toHaveProperty('name');
    expect(PROJECT_SESSION_HEADER).toHaveProperty('cwd');
    expect(PROJECT_SESSION_HEADER.cwd).not.toBe('');
  });

  test('header version is 2', () => {
    expect(GLOBAL_SESSION_HEADER.version).toBe(2);
    expect(PROJECT_SESSION_HEADER.version).toBe(2);
  });

  test('header type is session', () => {
    expect(GLOBAL_SESSION_HEADER.type).toBe('session');
    expect(PROJECT_SESSION_HEADER.type).toBe('session');
  });

  test('header id is non-empty string', () => {
    expect(typeof GLOBAL_SESSION_HEADER.id).toBe('string');
    expect(GLOBAL_SESSION_HEADER.id.length).toBeGreaterThan(0);
    expect(typeof PROJECT_SESSION_HEADER.id).toBe('string');
    expect(PROJECT_SESSION_HEADER.id.length).toBeGreaterThan(0);
  });

  test('header timestamp is positive number', () => {
    expect(typeof GLOBAL_SESSION_HEADER.timestamp).toBe('number');
    expect(GLOBAL_SESSION_HEADER.timestamp).toBeGreaterThan(0);
    expect(typeof PROJECT_SESSION_HEADER.timestamp).toBe('number');
    expect(PROJECT_SESSION_HEADER.timestamp).toBeGreaterThan(0);
  });

  test('header name is non-empty string', () => {
    expect(typeof GLOBAL_SESSION_HEADER.name).toBe('string');
    expect(GLOBAL_SESSION_HEADER.name.length).toBeGreaterThan(0);
    expect(typeof PROJECT_SESSION_HEADER.name).toBe('string');
    expect(PROJECT_SESSION_HEADER.name.length).toBeGreaterThan(0);
  });

  test('global header cwd is empty string', () => {
    expect(GLOBAL_SESSION_HEADER.cwd).toBe('');
  });

  test('project header cwd is non-empty string', () => {
    expect(typeof PROJECT_SESSION_HEADER.cwd).toBe('string');
    expect(PROJECT_SESSION_HEADER.cwd.length).toBeGreaterThan(0);
  });

  test('session header can be serialized to JSON', () => {
    expect(() => JSON.stringify(GLOBAL_SESSION_HEADER)).not.toThrow();
    expect(() => JSON.stringify(PROJECT_SESSION_HEADER)).not.toThrow();
  });

  test('session header can be parsed back from JSON', () => {
    const globalJson = JSON.stringify(GLOBAL_SESSION_HEADER);
    const parsed = JSON.parse(globalJson);
    expect(parsed).toEqual(GLOBAL_SESSION_HEADER);
  });
});