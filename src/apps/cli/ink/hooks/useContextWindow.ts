/**
 * useContextWindow - tracks context window token usage
 */
import { useEffect, useState } from 'react';
import type { AgentSession } from '@mariozechner/pi-coding-agent';
import { estimateTokens } from '@mariozechner/pi-coding-agent';

const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = {
  'o3': 128_000,
  'o4-mini': 200_000,
  'o1': 128_000,
  'o1-mini': 128_000,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4': 8_192,
  'gpt-3.5-turbo': 16_385,
  'claude-3-5-sonnet-4': 200_000,
  'claude-3-5-sonnet-3': 200_000,
  'claude-3-5-sonnet-2': 200_000,
  'claude-3-5-sonnet': 200_000,
  'claude-3-opus': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-haiku': 200_000,
  'gemini-1.5-pro': 1_000_000,
  'gemini-1.5-flash': 1_000_000,
  'gemini-1.5-pro-002': 2_000_000,
  'gemini-2.0-flash': 1_000_000,
  'gemini-2.5-pro': 1_000_000,
  'default': 128_000,
};

function getDefaultContextWindow(modelId: string | null): number {
  if (!modelId) return DEFAULT_CONTEXT_WINDOWS['default'];
  const lower = modelId.toLowerCase();
  for (const [key, value] of Object.entries(DEFAULT_CONTEXT_WINDOWS)) {
    if (lower.includes(key)) return value;
  }
  return DEFAULT_CONTEXT_WINDOWS['default'];
}

export interface ContextWindowState {
  used: number;
  limit: number;
  ratio: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

export function useContextWindow(session: AgentSession | null): ContextWindowState {
  const [state, setState] = useState<ContextWindowState>(() => {
    if (!session?.model) return { used: 0, limit: 0, ratio: 0, isNearLimit: false, isAtLimit: false };
    const limit = session.model.contextWindow ?? getDefaultContextWindow(session.model.id);
    return { used: 0, limit, ratio: 0, isNearLimit: false, isAtLimit: false };
  });

  useEffect(() => {
    if (!session) return;

    const recalc = () => {
      if (!session.model) return;
      const limit = session.model.contextWindow ?? getDefaultContextWindow(session.model.id);
      const used = estimateTokens(session);
      const ratio = used / limit;
      setState({
        used,
        limit,
        ratio,
        isNearLimit: ratio >= 0.80,
        isAtLimit: ratio >= 0.95,
      });
    };

    recalc();

    // Re-calc after agent messages complete
    session.on('message_end', recalc);
    session.on('message_update', recalc);
    session.on('auto_compaction_end', recalc);

    return () => {
      session.off('message_end', recalc);
      session.off('message_update', recalc);
      session.off('auto_compaction_end', recalc);
    };
  }, [session]);

  return state;
}
