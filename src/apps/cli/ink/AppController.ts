import { useEffect, useState } from 'react';
import { useApp, useStdout } from 'ink';
import type { AgentSession } from '../../core/index.js';
import { useAppStore } from './store/uiStore.js';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.js';
import { checkApiKeyConfigured, getModels, getProviders, ensureProvidersLoaded } from '../../core/index.js';

interface UseAppControllerOptions {
  initPromise?: Promise<AgentSession>;
}

export function useAppController({ initPromise }: UseAppControllerOptions = {}) {
  const { exit } = useApp();
  const page = useAppStore(state => state.page);
  const setPage = useAppStore(state => state.setPage);
  const { stdout } = useStdout();
  const [terminalSize, setTerminalSize] = useState({
    width: stdout.columns,
    height: stdout.rows,
  });

  useKeyboardShortcuts();

  // Once init completes, switch from init to welcome
  useEffect(() => {
    if (page !== 'init' || !initPromise) return;
    initPromise.then(async () => {
      setPage('welcome');

      // Load provider list then auto-detect first configured provider + model
      const providers = await ensureProvidersLoaded();
      for (const provider of providers) {
        if (checkApiKeyConfigured(provider)) {
          const models = getModels(provider);
          if (models && models.length > 0) {
            const { setCurrentModel } = useAppStore.getState();
            setCurrentModel(models[0].id);
            break;
          }
        }
      }
    });
  }, [page, initPromise, setPage]);

  useEffect(() => {
    // Terminal resize events only
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

  return {
    page,
    terminalSize,
  };
}
