/**
 * ContextBar - Context window usage indicator
 *
 * Shows a progress bar with used/limit tokens.
 * Color: cyan (<80%) -> yellow (80-95%) -> red (>95%)
 */
import React from 'react';
import { Text } from 'ink';
import { useContextWindow } from '../../hooks/useContextWindow.js';
import { getAgentSession } from '@codeagent/core';

const BAR_WIDTH = 10;

function formatToken(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContextBar() {
  const session = getAgentSession();
  const { used, limit, ratio, isNearLimit, isAtLimit } = useContextWindow(session);

  if (limit === 0) return null;

  const filled = Math.round(ratio * BAR_WIDTH);
  const barColor = isAtLimit ? 'red' : isNearLimit ? 'yellow' : 'cyan';

  return (
    <>
      <Text color="gray">Ctx </Text>
      <Text color="black" backgroundColor={barColor}>{'\u2588'.repeat(filled)}</Text>
      <Text dimColor>{'\u2591'.repeat(BAR_WIDTH - filled)}</Text>
      <Text color="gray"> </Text>
      <Text color={barColor}>{formatToken(used)}</Text>
      <Text color="gray">/</Text>
      <Text color="gray">{formatToken(limit)}</Text>
    </>
  );
}
