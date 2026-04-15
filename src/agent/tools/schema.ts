/**
 * ToolDefinition schema and types for CodeAgent tool registry.
 * Provides a standardized interface for all agent tools.
 */
import { z } from 'zod';

/**
 * Tool categories for classification and filtering.
 */
export const ToolCategoryEnum = z.enum(['file', 'terminal', 'web', 'code', 'system']);
export type ToolCategory = z.infer<typeof ToolCategoryEnum>;

/**
 * Example usage of a tool, for documentation and few-shot prompting.
 */
export const ToolExampleSchema = z.object({
  input: z.record(z.string(), z.unknown()),
  description: z.string(),
});
export type ToolExample = z.infer<typeof ToolExampleSchema>;

/**
 * A value that is a Zod schema instance (has a .parse method).
 */
function isZodSchema(v: unknown): boolean {
  return v !== null && typeof v === 'object' && typeof (v as any).parse === 'function';
}

/**
 * The canonical ToolDefinition schema — all CodeAgent tools must conform to this shape.
 * Used by ToolRegistry for startup validation and introspection.
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().describe('唯一工具标识符 (snake_case)'),
  label: z.string().describe('人类可读的操作标签，用于 UI'),
  description: z.string().describe('工具功能描述，一段以内'),
  category: ToolCategoryEnum.describe('工具分类'),
  parameters: z
    .custom(isZodSchema, {
      message: 'Must be a Zod schema instance (z.object, z.string, etc.)',
    })
    .describe('工具参数的 Zod schema'),
  examples: z.array(ToolExampleSchema).optional().describe('供 agent 使用的示例'),
  deprecationReason: z.string().optional().describe('如果设置，工具已弃用'),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
