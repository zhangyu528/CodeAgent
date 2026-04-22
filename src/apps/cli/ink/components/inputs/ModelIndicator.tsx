/**
 * ModelIndicator - displays the current model label
 */
import React from 'react';
import { Text } from 'ink';
import { useInput } from './InputController.js';

export function ModelIndicator() {
  const { modelLabel } = useInput();
  return (
    <Text>
      <Text color="gray">Model: </Text>
      {modelLabel ? (
        <Text color="blue" bold>{modelLabel}</Text>
      ) : (
        <Text color="red" italic>not configured</Text>
      )}
    </Text>
  );
}
