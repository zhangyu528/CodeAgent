/**
 * Unit tests for ToolRegistry class.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, ToolValidationError } from '../../../../src/agent/tools/registry.js';
import { ToolDefinitionSchema, ToolCategory } from '../../../../src/agent/tools/schema.js';

function createValidDefinition(
  overrides: Partial<{
    name: string;
    label: string;
    description: string;
    category: ToolCategory;
  }> = {}
): ReturnType<typeof ToolDefinitionSchema.parse> {
  return {
    name: 'test_tool',
    label: 'Test Tool',
    description: 'A test tool.',
    category: 'file',
    parameters: z.object({}),
    ...overrides,
  } as ReturnType<typeof ToolDefinitionSchema.parse>;
}

describe('ToolRegistry', () => {
  describe('register()', () => {
    it('registers a valid ToolDefinition', () => {
      const registry = new ToolRegistry();
      const def = createValidDefinition({ name: 'my_tool' });
      expect(() => registry.register(def)).not.toThrow();
      expect(registry.get('my_tool')).toBeDefined();
      expect(registry.get('my_tool')?.name).toBe('my_tool');
    });

    it('throws ToolValidationError for invalid ToolDefinition', () => {
      const registry = new ToolRegistry();
      const invalid = {
        name: 123,
        label: 'Bad',
        description: 'Bad',
        category: 'file',
        parameters: z.object({}),
      } as any;
      expect(() => registry.register(invalid)).toThrow(ToolValidationError);
    });

    it('throws when registering a tool with the same name twice', () => {
      const registry = new ToolRegistry();
      const def = createValidDefinition({ name: 'duplicate_tool' });
      registry.register(def);
      expect(() => registry.register(def)).toThrow('already registered');
    });
  });

  describe('get()', () => {
    it('returns registered tool by name', () => {
      const registry = new ToolRegistry();
      const def = createValidDefinition({ name: 'get_test' });
      registry.register(def);
      expect(registry.get('get_test')).toBe(def);
    });

    it('returns undefined for non-existent tool', () => {
      const registry = new ToolRegistry();
      expect(registry.get('non_existent')).toBeUndefined();
    });
  });

  describe('list()', () => {
    it('returns all tools when no category is provided', () => {
      const registry = new ToolRegistry();
      registry.register(createValidDefinition({ name: 'tool1' }));
      registry.register(createValidDefinition({ name: 'tool2' }));
      expect(registry.list()).toHaveLength(2);
    });

    it('returns only tools matching the given category', () => {
      const registry = new ToolRegistry();
      registry.register(createValidDefinition({ name: 'file_tool', category: 'file' }));
      registry.register(createValidDefinition({ name: 'terminal_tool', category: 'terminal' }));
      expect(registry.list('file')).toHaveLength(1);
      expect(registry.list('file')[0].name).toBe('file_tool');
      expect(registry.list('terminal')).toHaveLength(1);
      expect(registry.list('terminal')[0].name).toBe('terminal_tool');
    });
  });

  describe('introspect()', () => {
    it('returns all tools and unique categories', () => {
      const registry = new ToolRegistry();
      registry.register(createValidDefinition({ name: 'tool_a', category: 'file' }));
      registry.register(createValidDefinition({ name: 'tool_b', category: 'file' }));
      registry.register(createValidDefinition({ name: 'tool_c', category: 'terminal' }));

      const result = registry.introspect();
      expect(result.tools).toHaveLength(3);
      expect(result.categories).toContain('file');
      expect(result.categories).toContain('terminal');
      expect(result.categories).toHaveLength(2);
    });
  });
});
