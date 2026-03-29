import { useState, useCallback } from 'react';

export function useDebug(defaultVisible = false) {
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(defaultVisible);

  const addDebugMessage = useCallback((message: string) => {
    setDebugMessages(prev => [...prev.slice(-99), `[${new Date().toISOString().slice(11, 19)}] ${message}`]);
  }, []);

  const toggleDebug = useCallback(() => {
    setIsDebugVisible(prev => !prev);
  }, []);

  const clearDebug = useCallback(() => {
    setDebugMessages([]);
  }, []);

  return {
    debugMessages,
    isDebugVisible,
    setIsDebugVisible,
    addDebugMessage,
    toggleDebug,
    clearDebug,
  };
}
