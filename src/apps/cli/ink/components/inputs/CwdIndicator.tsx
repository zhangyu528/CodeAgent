/**
 * CwdIndicator - displays the current working directory
 */
import React from 'react';
import { Text } from 'ink';
import { useInput } from './InputController.js';

export function CwdIndicator() {
  const { cwdLabel } = useInput();
  return (
    <Text>
      <Text color="gray">CWD: </Text>
      <Text color="yellow" dimColor>{cwdLabel}</Text>
    </Text>
  );
}
