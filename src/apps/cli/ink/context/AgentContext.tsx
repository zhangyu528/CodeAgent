/**
 * AgentContext - Dependency injection for Agent
 * 
 * This allows the Agent to be injected via Context instead of
 * being a global singleton, enabling easier testing.
 */
import React, { createContext, useContext } from 'react';
import type { Agent } from '@mariozechner/pi-agent-core';

// For backwards compatibility with non-React code,
// we also allow direct import of getAgent()
import { getAgent as getGlobalAgent } from '../../../../agent/agent.js';

interface AgentContextValue {
  agent: Agent;
}

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  children: React.ReactNode;
  /**
   * Optional agent instance. If not provided, uses the global singleton.
   * This allows injection of mock agents for testing.
   */
  agent?: Agent;
}

/**
 * AgentProvider - Provides the Agent via React Context
 * 
 * Usage:
 * ```tsx
 * <AgentProvider>
 *   <App />
 * </AgentProvider>
 * ```
 * 
 * For testing with mock agent:
 * ```tsx
 * <AgentProvider agent={mockAgent}>
 *   <ChatPage />
 * </AgentProvider>
 * ```
 */
export function AgentProvider({ children, agent }: AgentProviderProps) {
  const agentInstance = agent ?? getGlobalAgent();
  
  return (
    <AgentContext.Provider value={{ agent: agentInstance }}>
      {children}
    </AgentContext.Provider>
  );
}

/**
 * useAgent - Hook to access the Agent instance
 * 
 * Must be used within an AgentProvider.
 * 
 * Usage:
 * ```tsx
 * const { agent } = useAgent();
 * ```
 */
export function useAgent(): Agent {
  const context = useContext(AgentContext);
  
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  
  return context.agent;
}

/**
 * getAgent - Direct access to global agent (backwards compatibility)
 * 
 * This is kept for non-React code that needs direct access.
 * In React components, prefer useAgent() for testability.
 */
export { getGlobalAgent as getAgent };
