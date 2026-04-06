import React from 'react';
import { Box } from 'ink';
import { Logo } from './Logo.js';
import { Input } from '../../components/inputs/index.js';

export function WelcomePage() {
  return (
    <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <Logo />
      <Input />
    </Box>
  );
}
