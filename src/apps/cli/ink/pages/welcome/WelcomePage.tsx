import React from 'react';
import { Box, Text } from 'ink';
import { Logo } from './Logo.js';
import { Input } from '../../components/inputs/index.js';
import { isFirstRun as checkFirstRun } from '../../../../core/index.js';

export function WelcomePage() {
  const [isFirst, setIsFirst] = React.useState(false);

  React.useEffect(() => {
    setIsFirst(checkFirstRun());
  }, []);

  return (
    <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <Logo />
      {isFirst && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text color="yellow" bold>首次使用请配置 API Key</Text>
          <Text dimColor>运行 /config 选择 provider 并输入 API Key</Text>
        </Box>
      )}
      <Input />
    </Box>
  );
}
