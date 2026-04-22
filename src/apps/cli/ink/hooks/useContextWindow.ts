/**
 * useContextWindow - tracks context window token usage
 */
import { useEffect, useState } from 'react';
import { type AgentSession } from '@mariozechner/pi-coding-agent';

export interface ContextWindowState {
  used: number;
  limit: number;
  ratio: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

export function useContextWindow(session: AgentSession | null): ContextWindowState {
  const [state, setState] = useState<ContextWindowState>(() => {
    return { used: 0, limit: 0, ratio: 0, isNearLimit: false, isAtLimit: false };
  });

  useEffect(() => {
    if (!session) return;

    const recalc = () => {
      const usage = session.getContextUsage();
      if (!usage || usage.tokens === null || usage.contextWindow === 0) return;
      const ratio = (usage.percent ?? usage.tokens / usage.contextWindow) / 100;
      setState({
        used: usage.tokens,
        limit: usage.contextWindow,
        ratio,
        isNearLimit: ratio >= 0.8,
        isAtLimit: ratio >= 0.95,
      });
    };

    recalc();
    const unsubscribe = session.subscribe(recalc);
    return unsubscribe;
  }, [session]);

  return state;
}
