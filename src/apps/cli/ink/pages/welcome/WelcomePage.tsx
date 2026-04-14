import React from 'react';
import { Box, Text } from 'ink';
import { Logo } from './Logo.js';
import { Input } from '../../components/inputs/index.js';

function isFirstRun(): boolean {
  // First run = no session files and no configured API keys
  try {
    const home = process.env.HOME;
    if (!home) return true;
    const sessionsDir = home + '/.codeagent/sessions';
    const { existsSync, readdirSync } = require('fs');
    if (existsSync(sessionsDir)) {
      const files: string[] = readdirSync(sessionsDir).filter((f: string) => f.endsWith('.json'));
      if (files.length > 0) return false;
    }
  } catch {
    // If we can't check, assume first run
  }

  // Check if any provider API key is configured
  const apiKeyVars = Object.keys(process.env).filter(
    k => k.endsWith('_API_KEY') && Boolean(process.env[k])
  );
  return apiKeyVars.length === 0;
}

export function WelcomePage() {
  const [isFirst, setIsFirst] = React.useState(false);

  React.useEffect(() => {
    setIsFirst(isFirstRun());
  }, []);

  return (
    <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <Logo />
      {isFirst && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text color="yellow" bold>首次使用请配置 API Key</Text>
          <Text dimColor>cp .env.example .env && 编辑添加你的 API Key</Text>
        </Box>
      )}
      <Input />
    </Box>
  );
}
