import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';

export type PiInkAppProps = {
  agent: Agent;
  onExit: () => void;
};

export function PiInkApp({ agent, onExit }: PiInkAppProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    // Subscribe to Agent events
    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'agent_start':
          setThinking(true);
          break;
        case 'agent_end':
          setThinking(false);
          break;
        case 'message_update':
          const assistantEvent = event.assistantMessageEvent;
          if (assistantEvent.type === 'text_delta') {
            setThinking(false);
            const delta = assistantEvent.delta;
            setLines(prev => {
              const last = prev[prev.length - 1] || '';
              if (last.startsWith('❯ ')) {
                return [...prev, delta];
              }
              return [...prev.slice(0, -1), last + delta];
            });
          } else if (assistantEvent.type === 'thinking_delta') {
            setThinking(true);
            // Optional: handle thinking delta
          }
          break;
        case 'tool_execution_start':
          setLines(prev => [...prev, `[Tool: ${event.toolName}] ${JSON.stringify(event.args)}`]);
          break;
        case 'tool_execution_end':
          setLines(prev => [...prev, `[Result: ${event.toolName}] ${event.isError ? 'Failed' : 'Success'}`]);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [agent]);

  // For testing/demonstration, we assume the initial prompt is handled externally or via agent.prompt()
  
  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((l, i) => (
          <Text key={i}>{l}</Text>
        ))}
      </Box>
      {thinking && <Text color="yellow">Agent is thinking...</Text>}
    </Box>
  );
}
