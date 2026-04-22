/**
 * useEscapeChat - Escape sequence based chat rendering
 * 
 * This hook manages the escape sequence chat renderer and syncs it with the chat store.
 * It's an alternative to the Ink-based MessageList for better streaming performance.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { EscapeChatRenderer, createEscapeChatRenderer } from './escapeChatRenderer.js';
import { TerminalScrollRegion } from './terminalScroll.js';
import { useChatStore } from '../store/index.js';
import { ChatMessage } from '../pages/types.js';

interface UseEscapeChatOptions {
  headerRows?: number;
  footerRows?: number;
}

export function useEscapeChat(options: UseEscapeChatOptions = {}) {
  const { headerRows = 2, footerRows = 3 } = options;
  
  const rendererRef = useRef<EscapeChatRenderer | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const messages = useChatStore(state => state.messages);
  const currentSession = useChatStore(state => state.currentSession);
  
  // Initialize renderer on mount
  useEffect(() => {
    rendererRef.current = createEscapeChatRenderer({
      headerRows,
      footerRows,
    });
    
    rendererRef.current.start();
    setIsReady(true);
    
    // Handle resize
    const handleResize = () => {
      rendererRef.current?.resize();
    };
    process.stdout.on('resize', handleResize);
    
    return () => {
      rendererRef.current?.stop();
      process.stdout.off('resize', handleResize);
    };
  }, [headerRows, footerRows]);
  
  // Sync session name
  useEffect(() => {
    if (rendererRef.current && currentSession) {
      rendererRef.current.setSession(currentSession.title);
    }
  }, [currentSession]);
  
  // Sync messages
  useEffect(() => {
    if (rendererRef.current && messages.length > 0) {
      rendererRef.current.setMessages(messages);
    }
  }, [messages]);
  
  // Add new message
  const addMessage = useCallback((msg: ChatMessage) => {
    rendererRef.current?.addMessage(msg);
  }, []);
  
  // Update last message (for streaming)
  const updateLastMessage = useCallback((updater: (msg: ChatMessage) => ChatMessage) => {
    rendererRef.current?.updateLastMessage(updater);
  }, []);
  
  return {
    isReady,
    addMessage,
    updateLastMessage,
    renderer: rendererRef.current,
  };
}

// Export the renderer class for direct use
export { EscapeChatRenderer } from './escapeChatRenderer.js';
export { TerminalScrollRegion } from './terminalScroll.js';
