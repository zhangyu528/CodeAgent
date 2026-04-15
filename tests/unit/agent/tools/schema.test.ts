/**
 * Unit tests for ToolDefinitionSchema and types.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolDefinitionSchema, ToolCategory } from '../../../../src/agent/tools/schema.js';

describe('ToolDefinitionSchema', () => {
  it('validates a minimal valid ToolDefinition', () => {
    const valid = {
      name: 'read_file',
      label: 'Reading File',
      description: 'Read file contents.',
      category: 'file' as ToolCategory,
      parameters: z.object({ filePath: z.string() }),
    };
    const result = ToolDefinitionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('validates with all optional fields', () => {
    const valid = {
      name: 'read_file',
      label: 'Reading File',
      description: 'Read file contents.',
      category: 'file' as ToolCategory,
      parameters: z.object({ filePath: z.string() }),
      examples: [{ input: { filePath: '/tmp/test.txt' }, description: 'Read a text file' }],
      deprecationReason: 'Use new_read_file instead',
    };
    const result = ToolDefinitionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing required field name', () => {
    const invalid = {
      label: 'Reading File',
      description: 'Read file contents.',
      category: 'file',
      parameters: z.object({}),
    };
    const result = ToolDefinitionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const invalid = {
      name: 'read_file',
      label: 'Reading File',
      description: 'Read file contents.',
      category: 'invalid_category',
      parameters: z.object({}),
    };
    const result = ToolDefinitionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-string name', () => {
    const invalid = {
      name: 123,
      label: 'Reading File',
      description: 'Read file contents.',
      category: 'file',
      parameters: z.object({}),
    };
    const result = ToolDefinitionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-Zod-schema parameters', () => {
    const invalid = {
      name: 'read_file',
      label: 'Reading File',
      description: 'Read file contents.',
      category: 'file',
      parameters: { not: 'a zod schema' },
    };
    const result = ToolDefinitionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
