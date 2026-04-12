/**
 * Token Tracking Module
 * 
 * This module tracks token usage across model calls.
 * Token usage data is obtained from chatStore's usage state,
 * which is updated by agent events in useAgentEvents.ts.
 */

import { useCallback, useMemo } from 'react';
import { useChatStore } from '../store/index.js';

// Token tracking state interface
export interface TokenTrackingState {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Hook for tracking token usage
 * 
 * This hook provides functions to track and retrieve token usage data
 * from the chatStore, which is updated by agent events.
 */
export function useTokenTracking() {
  // Get current usage from chatStore
  const usage = useChatStore(state => state.usage);
 
  // Get the setUsage function to update token usage
  const setUsage = useChatStore(state => state.setUsage);

  /**
   * Computed token tracking state derived from usage
   * Memoized to avoid recalculating on every render
   */
  const tokenUsage: TokenTrackingState = useMemo(() => {
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
    }
    return {
      inputTokens: usage.input,
      outputTokens: usage.output,
      totalTokens: usage.input + usage.output,
    };
  }, [usage]);

  /**
   * Track tokens by updating the usage in chatStore
   * This accumulates the input and output tokens
   */
  const trackTokens = useCallback((input: number, output: number) => {
    const currentUsage = useChatStore.getState().usage;
    const newInput = (currentUsage?.input || 0) + input;
    const newOutput = (currentUsage?.output || 0) + output;
    const newCost = (currentUsage?.cost || 0) + (input * 0.001 + output * 0.002); // Approximate cost calculation
    
    setUsage({
      input: newInput,
      output: newOutput,
      cost: newCost,
    });
  }, [setUsage]);

  /**
   * Reset token usage to initial state
   */
  const resetTokenUsage = useCallback(() => {
    setUsage(null);
  }, [setUsage]);

  return {
    trackTokens,
    tokenUsage,
    resetTokenUsage,
  };
}
