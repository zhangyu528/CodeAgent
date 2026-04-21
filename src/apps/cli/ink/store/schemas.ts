/**
 * Zod Schemas for Zustand Stores
 *
 * This module defines Zod schemas as the single source of truth for store state types.
 * Use z.infer<> to derive TypeScript types from these schemas.
 *
 * Benefits:
 * - Compile-time type safety from runtime-validated schemas
 * - Consistent validation at store action boundaries
 * - Single source of truth for state shape
 */
import { z } from 'zod';

// ============================================================================
// ChatMessageBlock Schema
// ============================================================================

export const ChatMessageBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    kind: z.literal('thinking'),
    text: z.string(),
    collapsed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('reasoning'),
    text: z.string(),
    collapsed: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('toolSummary'),
    text: z.string(),
    collapsed: z.boolean().optional(),
  }),
]);

export type ChatMessageBlock = z.infer<typeof ChatMessageBlockSchema>;

// ============================================================================
// ChatMessage Schema
// ============================================================================

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'error']),
  title: z.string(),
  createdAt: z.number(),
  status: z.enum(['streaming', 'completed', 'error']).optional(),
  blocks: z.array(ChatMessageBlockSchema),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// ChatSessionInfo Schema
// ============================================================================

export const ChatSessionInfoSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  status: z.string(),
  updatedAt: z.number(),
  messageCount: z.number(),
});

export type ChatSessionInfo = z.infer<typeof ChatSessionInfoSchema>;

// ============================================================================
// MessageStore State Schema
// ============================================================================

export const MessageStoreStateSchema = z.object({
  messages: z.array(ChatMessageSchema),
  thinking: z.boolean(),
  usage: z
    .object({
      input: z.number(),
      output: z.number(),
      cost: z.number(),
    })
    .nullable(),
});

export type MessageStoreState = z.infer<typeof MessageStoreStateSchema>;

// ============================================================================
// Partial Update Schemas (for Zustand setState partial updates)
// ============================================================================

/**
 * Partial ChatMessage for update operations.
 * Allows updating individual fields without requiring the full object.
 */
export const ChatMessagePartialSchema = ChatMessageSchema.partial();

export type ChatMessagePartial = z.infer<typeof ChatMessagePartialSchema>;
