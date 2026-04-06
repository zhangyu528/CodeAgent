import { useEffect, useState } from 'react';
import { useApp, useStdout } from 'ink';
import { useAppStore } from './store/uiStore.js';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.js';

const LOADING_SCREEN_DELAY_MS = 800;

export function useAppController() {
  const { exit } = useApp();
  const page = useAppStore(state => state.page);
  const setPage = useAppStore(state => state.setPage);
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({
    width: stdout.columns,
    height: stdout.rows,
  });

  useKeyboardShortcuts();

  useEffect(() => {
    const handleResize = () => {
      setTerminalSize({
        width: stdout.columns,
        height: stdout.rows,
      });
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, [stdout]);

  useEffect(() => {
    if (page !== 'loading') return;

    const timer = setTimeout(() => {
      setPage('welcome');
    }, LOADING_SCREEN_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [page, setPage]);

  return {
    page,
    terminalSize,
  };
}
