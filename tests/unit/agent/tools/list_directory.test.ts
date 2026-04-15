/**
 * Unit tests for list_directory tool
 * Tests path traversal protection and workspace root isolation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { listDirectoryTool } from '../../../../src/agent/tools/list_directory.js';

const simulateCall = async (
  directoryPath: string
): Promise<{ success: boolean; reason?: string; text?: string }> => {
  delete process.env.CODEAGENT_WORKSPACE_ROOT;
  const result = await listDirectoryTool.execute('test-call-id', { directoryPath });
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
  const success = !text.startsWith('Error:');
  const reason = result.details?.reason as string | undefined;
  return { success, reason, text };
};

describe('list_directory tool', () => {
  beforeEach(() => {
    delete process.env.CODEAGENT_WORKSPACE_ROOT;
  });

  describe('path traversal protection', () => {
    it('blocks home directory paths with ~', async () => {
      const result = await simulateCall('~/');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('path_traversal');
    });

    it('blocks home directory paths in subdirectories', async () => {
      const result = await simulateCall('/home/user/../~');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('path_traversal');
    });
  });

  describe('error handling', () => {
    it('returns error text when directory does not exist', async () => {
      const result = await simulateCall('/this/path/does/not/exist');
      expect(result.success).toBe(false);
      expect(result.text).toContain('Error:');
    });
  });
});
