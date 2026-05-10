/**
 * ContextBar - Context window usage indicator
 *
 * Shows a progress bar with used/limit tokens.
 * Color: cyan (<80%) -> yellow (80-95%) -> red (>95%)
 */
import React from 'react';
import { Text } from 'ink';
import { useContextWindow } from '../../hooks/useContextWindow.js';
import { getAgentSession } from '@codeagent/backend';

const BAR_WIDTH = 10;

function formatToken(n: number): string {
  if (!isFinite(n)) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContextBar() {
  const session = getAgentSession();
  const { used, limit, ratio, isNearLimit, isAtLimit } = useContextWindow(session);

  if (limit === 0 || !isFinite(ratio)) return null;

  const filled = Math.round(ratio * BAR_WIDTH);
  const barColor = ratio >= 0.95 ? 'red' : ratio >= 0.8 ? 'yellow' : 'cyan';

  return (
    <>
      <Text color="gray">Ctx </Text>
      <Text color={barColor}>{'\u2588'.repeat(filled)}</Text>
      <Text color={barColor}>{'\u2591'.repeat(BAR_WIDTH - filled)}</Text>
      <Text color="gray"> </Text>
      <Text color={barColor}>{formatToken(used)}</Text>
      <Text color="gray">/</Text>
      <Text color="gray">{formatToken(limit)}</Text>
      <Text color="gray"> </Text>
      <Text color={barColor}>{Math.round(ratio * 100)}%</Text>
    </>
  );
}
