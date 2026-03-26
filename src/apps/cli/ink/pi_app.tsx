import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Box, useInput, useApp, useStdout } from 'ink';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';
import { WelcomePage, ChatPage } from './components/pages/index.js';
import { InputArea } from './components/inputs/index.js';
import { ModalOverlay } from './components/overlays/index.js';
import { sessionManager } from '../../../core/pi/sessions.js';
import { useModelConfig } from './hooks/useModelConfig.js';
import { createInitialState, LineItem, piAppReducer } from './state/pi_app_reducer.js';

export type PiInkAppProps = {
  agent: Agent;
  onExit: () => void;
};

const SLASH_COMMANDS = [
  { name: '/help', description: 'Show available commands', category: 'System', usage: '/help' },
  { name: '/clear', description: 'Clear current chat display', category: 'System', usage: '/clear' },
  { name: '/new', description: 'Return to welcome page', category: 'System', usage: '/new' },
  { name: '/model', description: 'Select LLM provider and model', category: 'Config', usage: '/model' },
  { name: '/history', description: 'View session history', category: 'Session', usage: '/history' },
  { name: '/resume', description: 'Continue last session', category: 'Session', usage: '/resume' },
];

type SessionLike = { id: string; messages: any[] };

function toSessionLines(messages: any[]): LineItem[] {
  return messages.map((m: any, i: number) => ({
    id: m.id || `restored-${i}`,
    text: m.role === 'user' ? `❯ ${m.content}` : m.content,
    isAssistant: m.role === 'assistant',
  }));
}

export function PiInkApp({ agent, onExit }: PiInkAppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, dispatch] = useReducer(
    piAppReducer,
    createInitialState(stdout.columns || 80, stdout.rows || 24)
  );
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { columns, rows } = state.dimensions;
  const modelConfig = useModelConfig(agent);

  const historyItems = useMemo(
    () => sessionManager.getHistory(),
    [state.historyVisible, state.page]
  );

  const isSlashVisible = state.inputValue.startsWith('/') && !state.inputValue.includes(' ');
  const filteredCommands = useMemo(() => {
    if (!isSlashVisible) return [];
    return SLASH_COMMANDS.filter(c => c.name.startsWith(state.inputValue));
  }, [state.inputValue, isSlashVisible]);

  const cwd = useMemo(() => process.cwd(), []);
  const model = agent.state.model;
  const provider = model?.provider || '';
  const modelId = model?.id || '';
  const isModelConfigured = !!(model && model.id);
  const version = '1.0.0';

  const restoreSessionToUI = (session: SessionLike | null): boolean => {
    if (!session) return false;
    agent.sessionId = session.id;
    agent.replaceMessages(session.messages);
    dispatch({ type: 'SESSION_RESTORED', lines: toSessionLines(session.messages) });
    return true;
  };

  const runPrompt = (cmd: string) => {
    dispatch({ type: 'COMMAND_EXEC', op: 'append_user_line', text: `❯ ${cmd}` });
    agent.prompt(cmd).catch(err => {
      dispatch({ type: 'COMMAND_EXEC', op: 'append_system_line', text: `Error: ${err.message}` });
    });
  };

  const commandHandlers: Record<string, () => void> = useMemo(() => ({
    '/clear': () => dispatch({ type: 'COMMAND_EXEC', op: 'clear' }),
    '/new': () => dispatch({ type: 'COMMAND_EXEC', op: 'goto_welcome' }),
    '/help': () => {
      const helpText = SLASH_COMMANDS.map(c => `${c.name.padEnd(12)} - ${c.description}`).join('\n');
      dispatch({
        type: 'COMMAND_EXEC',
        op: 'show_prompt',
        prompt: { kind: 'ask', message: `Available Commands:\n\n${helpText}`, value: '' },
      });
    },
    '/model': () => {
      modelConfig.startConfig();
      dispatch({ type: 'INPUT_KEY', op: 'clear_value' });
    },
    '/history': () => dispatch({ type: 'COMMAND_EXEC', op: 'show_history' }),
    '/resume': () => {
      const latestId = sessionManager.getLatestSessionId();
      if (latestId && restoreSessionToUI(sessionManager.loadSession(latestId) as SessionLike | null)) {
        dispatch({ type: 'INPUT_KEY', op: 'clear_value' });
        return;
      }
      dispatch({
        type: 'COMMAND_EXEC',
        op: 'show_prompt',
        prompt: { kind: 'ask', message: 'No previous sessions found.', value: '' },
      });
    },
  }), [modelConfig]);

  const executeCommand = (cmdName: string) => {
    const cmd = cmdName.trim();

    const handler = commandHandlers[cmd];
    if (handler) {
      handler();
      return;
    }

    if (cmd.startsWith('/')) {
      dispatch({ type: 'COMMAND_EXEC', op: 'append_system_line', text: `Unknown command: ${cmd}` });
      return;
    }

    if (state.thinking) return;

    if (!isModelConfigured) {
      modelConfig.startConfig(cmd);
      dispatch({ type: 'INPUT_KEY', op: 'clear_value' });
      return;
    }

    runPrompt(cmd);
  };

  useEffect(() => {
    const handleResize = () => {
      dispatch({
        type: 'UI_EVENT',
        op: 'set_dimensions',
        columns: stdout.columns || 80,
        rows: stdout.rows || 24,
      });
    };
    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  useEffect(() => {
    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'agent_start':
          dispatch({ type: 'AGENT_EVENT', op: 'agent_start' });
          break;
        case 'agent_end':
          dispatch({ type: 'AGENT_EVENT', op: 'agent_end' });
          if (agent.sessionId) sessionManager.saveSession(agent.sessionId, agent.state.messages);
          break;
        case 'message_update': {
          const assistantEvent = event.assistantMessageEvent;
          if (assistantEvent.type === 'text_delta') {
            dispatch({ type: 'AGENT_EVENT', op: 'text_delta', delta: assistantEvent.delta });
          } else if (assistantEvent.type === 'thinking_delta') {
            dispatch({ type: 'AGENT_EVENT', op: 'thinking_delta', delta: assistantEvent.delta });
          }
          break;
        }
        case 'message_end': {
          const msg = event.message as any;
          if (msg.stopReason === 'error' && msg.errorMessage) {
            dispatch({ type: 'AGENT_EVENT', op: 'error', message: msg.errorMessage });
          }
          if (msg.usage) {
            dispatch({
              type: 'AGENT_EVENT',
              op: 'usage',
              usage: {
                input: msg.usage.inputTokens || msg.usage.input || 0,
                output: msg.usage.outputTokens || msg.usage.output || 0,
                cost: msg.usage.cost?.total || 0,
              },
            });
          }
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [agent]);

  useEffect(() => {
    dispatch({ type: 'MODEL_CONFIG_EVENT', op: 'sync_prompt', prompt: modelConfig.pendingPrompt });
  }, [modelConfig.pendingPrompt]);

  useEffect(() => {
    if (
      !modelConfig.isActive &&
      modelConfig.pendingCommand &&
      state.pendingCommandAfterConfig !== modelConfig.pendingCommand
    ) {
      const cmd = modelConfig.pendingCommand;
      dispatch({ type: 'MODEL_CONFIG_EVENT', op: 'remember_pending_command', command: cmd });
      runPrompt(cmd);
    }
  }, [modelConfig.isActive, modelConfig.pendingCommand, state.pendingCommandAfterConfig]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const hideExitPrompt = () => dispatch({ type: 'EXIT_CONFIRM_EVENT', op: 'hide' });

  const showExitPrompt = () => {
    dispatch({ type: 'EXIT_CONFIRM_EVENT', op: 'show' });
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = setTimeout(() => {
      dispatch({ type: 'EXIT_CONFIRM_EVENT', op: 'hide' });
    }, 3000);
  };

  const updatePromptSelection = (nextSelected: number) => {
    if (state.prompt.kind !== 'selectOne') return;
    dispatch({
      type: 'COMMAND_EXEC',
      op: 'show_prompt',
      prompt: { ...state.prompt, selected: nextSelected },
    });
  };

  const handleExitKey = (input: string, key: { ctrl?: boolean }): boolean => {
    const isExitKey =
      (key.ctrl && (input === 'c' || input === 'd')) ||
      input === '\u0003' ||
      input === '\u0004';

    if (!isExitKey) return false;

    if (state.exitPromptVisible) {
      onExit();
      exit();
      return true;
    }

    showExitPrompt();
    return true;
  };

  const handleEscapeKey = (key: { escape?: boolean }): boolean => {
    if (!key.escape) return false;

    if (state.exitPromptVisible) {
      hideExitPrompt();
      return true;
    }

    if (modelConfig.isActive) {
      modelConfig.cancelConfig();
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_prompt' });
      return true;
    }

    if (state.prompt.kind !== 'none') {
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_prompt' });
      return true;
    }

    if (state.historyVisible) {
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_history' });
      return true;
    }

    return true;
  };

  const handleModelConfigInput = (input: string, key: any): boolean => {
    if (!modelConfig.isActive) return false;

    if (modelConfig.step === 'entering_api_key') {
      if (key.return) {
        modelConfig.onApiKeySubmit();
        return true;
      }
      modelConfig.onApiKeyInput(key, input);
      return true;
    }

    if (key.upArrow) {
      modelConfig.onKeyUp();
      return true;
    }

    if (key.downArrow) {
      modelConfig.onKeyDown();
      return true;
    }

    if (key.return) {
      modelConfig.onKeyReturn(input);
      return true;
    }

    return true;
  };

  const handlePromptInput = (key: any): boolean => {
    if (state.prompt.kind === 'none') return false;

    if (state.prompt.kind === 'selectOne') {
      if (key.upArrow) {
        updatePromptSelection(Math.max(0, state.prompt.selected - 1));
        return true;
      }

      if (key.downArrow) {
        updatePromptSelection(Math.min(state.prompt.choices.length - 1, state.prompt.selected + 1));
        return true;
      }

      if (key.return) {
        if (state.prompt.message.includes('Sessions')) {
          const sessionInfo = sessionManager.getHistory()[state.prompt.selected];
          if (sessionInfo) {
            restoreSessionToUI(sessionManager.loadSession(sessionInfo.id) as SessionLike | null);
          }
        }
        dispatch({ type: 'COMMAND_EXEC', op: 'hide_prompt' });
        return true;
      }
    }

    if ((state.prompt.kind === 'ask' || state.prompt.kind === 'confirm') && key.return) {
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_prompt' });
      return true;
    }

    return true;
  };

  const handleHistoryInput = (key: any): boolean => {
    if (!state.historyVisible) return false;

    if (key.upArrow) {
      dispatch({ type: 'INPUT_KEY', op: 'history_up' });
      return true;
    }

    if (key.downArrow) {
      dispatch({ type: 'INPUT_KEY', op: 'history_down', max: historyItems.length - 1 });
      return true;
    }

    if (key.return) {
      const selected = historyItems[state.historySelected];
      if (selected) {
        restoreSessionToUI(sessionManager.loadSession(selected.id) as SessionLike | null);
      }
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_history' });
      return true;
    }

    return true;
  };

  const handleSlashInput = (key: any): boolean => {
    if (!isSlashVisible) return false;

    if (key.upArrow) {
      dispatch({ type: 'INPUT_KEY', op: 'slash_up' });
      return true;
    }

    if (key.downArrow) {
      dispatch({ type: 'INPUT_KEY', op: 'slash_down', max: filteredCommands.length - 1 });
      return true;
    }

    const selected = filteredCommands[state.slashSelected];
    if (key.tab && selected) {
      dispatch({ type: 'INPUT_KEY', op: 'set_value', value: selected.name });
      return true;
    }

    if (key.return && selected) {
      executeCommand(selected.name);
      return true;
    }

    return false;
  };

  const handleRegularInput = (input: string, key: any): boolean => {
    if (key.return) {
      executeCommand(state.inputValue);
      return true;
    }

    if (key.backspace || key.delete) {
      dispatch({ type: 'INPUT_KEY', op: 'backspace' });
      return true;
    }

    if (!key.ctrl && !key.meta && input) {
      dispatch({ type: 'INPUT_KEY', op: 'append_value', value: input });
      return true;
    }

    return false;
  };

  useInput((input, key) => {
    if (handleExitKey(input, key)) return;
    if (handleEscapeKey(key)) return;

    if (state.exitPromptVisible) {
      hideExitPrompt();
    }

    if (handleModelConfigInput(input, key)) return;
    if (handlePromptInput(key)) return;
    if (handleHistoryInput(key)) return;
    if (handleSlashInput(key)) return;
    handleRegularInput(input, key);
  });

  const isDimmed = state.prompt.kind !== 'none' || modelConfig.isActive;

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Box flexGrow={1} flexDirection="column">
        {state.page === 'welcome' ? (
          <WelcomePage version={version} cwd={cwd} provider={provider} logs={[]} rows={rows} cols={columns} isDimmed={isDimmed}>
            <InputArea
              value={state.inputValue}
              page={state.page}
              slashVisible={isSlashVisible}
              slashItems={filteredCommands}
              slashSelected={state.slashSelected}
              historyVisible={state.historyVisible}
              historyItems={historyItems}
              historySelected={state.historySelected}
              modelName={modelId}
              cwd={cwd}
              isDimmed={isDimmed}
              exitPromptVisible={state.exitPromptVisible}
              thinking={state.thinking}
              usage={state.usage}
            />
          </WelcomePage>
        ) : (
          <ChatPage lines={state.lines} isDimmed={isDimmed} />
        )}
      </Box>
      {state.page === 'chat' && (
        <Box flexShrink={0}>
          <InputArea
            value={state.inputValue}
            page={state.page}
            slashVisible={isSlashVisible}
            slashItems={filteredCommands}
            slashSelected={state.slashSelected}
            historyVisible={state.historyVisible}
            historyItems={historyItems}
            historySelected={state.historySelected}
            modelName={modelId}
            cwd={cwd}
            isDimmed={isDimmed}
            exitPromptVisible={state.exitPromptVisible}
            thinking={state.thinking}
            usage={state.usage}
          />
        </Box>
      )}
      <ModalOverlay prompt={state.prompt} columns={columns} rows={rows} />
    </Box>
  );
}




