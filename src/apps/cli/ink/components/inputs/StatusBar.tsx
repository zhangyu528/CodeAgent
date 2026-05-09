/**
 * StatusBar - Unified status indicator combining model, TH, and context usage
 *
 * Layout: MiniMax-M2 | TH:H | ▓░░░░░░░░ 1.8K/205K 1%
 * Colors: model (blue), TH indicator (green/yellow/red), context bar (cyan/yellow/red)
 */
import React from 'react';
import { Text } from 'ink';
import { useContextWindow } from '../../hooks/useContextWindow.js';
import { useInput } from './InputController.js';
import { getAgentSession } from '@codeagent/core';

const BAR_WIDTH = 8;

function formatToken(n: number): string {
  if (!isFinite(n)) return '?';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface StatusBarProps {
  /** Show compact mode (shorter bar, fewer details) */
  compact?: boolean;
}

export function StatusBar({ compact = false }: StatusBarProps) {
  const session = getAgentSession();
  const { used, limit, ratio, isNearLimit, isAtLimit } = useContextWindow(session);
  const { modelLabel } = useInput();

  // TH indicator logic (placeholder - customize based on your needs)
  const thLevel = ratio >= 0.95 ? 'H' : ratio >= 0.8 ? 'M' : 'L';
  const thColor = ratio >= 0.95 ? 'red' : ratio >= 0.8 ? 'yellow' : 'green';

  // Context bar color
  const barColor = ratio >= 0.95 ? 'red' : ratio >= 0.8 ? 'yellow' : 'cyan';

  if (limit === 0 || !isFinite(ratio)) {
    return (
      <Text>
        <Text color="gray">no context limit</Text>
      </Text>
    );
  }

  const filled = Math.round(ratio * BAR_WIDTH);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);

  if (compact) {
    return (
      <Text>
        {modelLabel ? (
          <Text color="blue" bold>
            {modelLabel}
          </Text>
        ) : (
          <Text color="red" italic>
            not set
          </Text>
        )}
        <Text color="gray"> |</Text>
        <Text color={thColor} bold>
          TH:{thLevel}
        </Text>
        <Text color="gray"> |</Text>
        <Text color={barColor}>{bar}</Text>
        <Text color="gray"> </Text>
        <Text color={barColor}>{Math.round(ratio * 100)}%</Text>
      </Text>
    );
  }

  return (
    <Text>
      {modelLabel ? (
        <Text color="blue" bold>
          {modelLabel}
        </Text>
      ) : (
        <Text color="red" italic>
          not set
        </Text>
      )}
      <Text color="gray"> | </Text>
      <Text color={thColor} bold>
        TH:{thLevel}
      </Text>
      <Text color="gray"> | </Text>
      <Text color={barColor}>{bar}</Text>
      <Text color="gray"> </Text>
      <Text color={barColor}>
        {formatToken(used)}/{formatToken(limit)}
      </Text>
      <Text color="gray"> </Text>
      <Text color={barColor}>{Math.round(ratio * 100)}%</Text>
    </Text>
  );
}
