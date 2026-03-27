import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { randomUUID } from 'crypto';
import { Box, useInput, useApp, useStdout, useStdin } from 'ink';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';
import { WelcomePage, ChatPage } from './components/pages/index.js';
import { ChatSessionInfo } from './components/pages/types.js';
import { InputArea } from './components/inputs/index.js';
import { ModalOverlay } from './components/overlays/index.js';
import { sessionManager, SessionInfo, SessionRecord, SessionStatus } from '../../../core/pi/sessions.js';
import { useModelConfig } from './hooks/useModelConfig.js';
import { createInitialState, LineItem, piAppReducer } from './state/pi_app_reducer.js';

export type PiInkAppProps = {
  agent: Agent;
  onExit: () => void;
};

const SLASH_COMMANDS = [
  { name: '/help', description: 'Show available commands', category: 'System', usage: '/help' },
  { name: '/new', description: 'Create and switch to new session', category: 'Session', usage: '/new' },
  { name: '/model', description: 'Select LLM provider and model', category: 'Config', usage: '/model' },
  { name: '/history', description: 'View session history', category: 'Session', usage: '/history' },
  { name: '/resume', description: 'Continue last session', category: 'Session', usage: '/resume' },
];

type FocusOwner = 'exitConfirm' | 'modelConfig' | 'modal' | 'slash' | 'mainInput';

function toSessionLines(messages: any[]): LineItem[] {
  const toDisplayText = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          if (item && typeof item.content === 'string') return item.content;
          if (item && typeof item.input_text === 'string') return item.input_text;
          if (item && typeof item.thinking === 'string') return item.thinking;
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
    if (content && typeof content === 'object') {
      const item = content as any;
      if (typeof item.text === 'string') return item.text;
      if (typeof item.content === 'string') return item.content;
      if (typeof item.input_text === 'string') return item.input_text;
      if (typeof item.thinking === 'string') return item.thinking;
    }
    return '';
  };

  return messages.map((m: any, i: number) => ({
    id: m.id || `restored-${i}`,
    text: m.role === 'user' ? `❯ ${toDisplayText(m.content)}` : toDisplayText(m.content),
    isAssistant: m.role === 'assistant',
  }));
}

function extractSessionTitle(text: string): string {
  const normalized = (text || '').trim();
  if (!normalized) return 'New Session';
  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

function extractSessionTitleFromMessages(messages: any[]): string {
  const firstUser = messages.find((m: any) => m.role === 'user' && typeof m.content === 'string');
  return extractSessionTitle(firstUser?.content || '');
}

function createSessionId(): string {
  try {
    return randomUUID();
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function toSessionView(session: SessionRecord): ChatSessionInfo {
  return {
    id: session.meta.id,
    title: session.meta.title,
    status: session.meta.status,
    updatedAt: session.meta.updatedAt,
    messageCount: session.meta.messageCount,
  };
}

export function PiInkApp({ agent, onExit }: PiInkAppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { isRawModeSupported, setRawMode } = useStdin();
  const [state, dispatch] = useReducer(
    piAppReducer,
    createInitialState(stdout.columns || 80, stdout.rows || 24)
  );
  const [historyItems, setHistoryItems] = useState<SessionInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSessionInfo | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTurnStatusRef = useRef<SessionStatus>('completed');
  const persistCurrentSessionRef = useRef<(status?: SessionStatus) => void>(() => {});

  const { columns, rows } = state.dimensions;
  const modelConfig = useModelConfig(agent);

  const isSlashVisible = state.inputValue.startsWith('/') && !state.inputValue.includes(' ');
  const filteredCommands = useMemo(() => {
    if (!isSlashVisible) return [];
    return SLASH_COMMANDS.filter(c => c.name.startsWith(state.inputValue));
  }, [state.inputValue, isSlashVisible]);

  const hasModal = state.modal.kind !== 'none';
  const focusOwner: FocusOwner = state.exitPromptVisible
    ? 'exitConfirm'
    : modelConfig.isActive
      ? 'modelConfig'
      : hasModal
        ? 'modal'
        : isSlashVisible
          ? 'slash'
          : 'mainInput';

  const cwd = useMemo(() => process.cwd(), []);
  const model = agent.state.model;
  const provider = model?.provider || '';
  const modelId = model?.id || '';
  const isModelConfigured = !!(model && model.id);
  const version = '1.0.0';

  useEffect(() => {
    if (!isRawModeSupported) return;
    setRawMode(true);
    return () => {
      setRawMode(false);
    };
  }, [isRawModeSupported, setRawMode]);

  const setStableSessionId = useCallback((id: string | null) => {
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
  }, []);

  const refreshHistory = useCallback(async () => {
    const history = await sessionManager.getHistory(50);
    setHistoryItems(history);
  }, []);

  const persistCurrentSession = useCallback((status: SessionStatus = 'completed') => {
    const stableSessionId = activeSessionIdRef.current;
    if (!stableSessionId) return;
    agent.sessionId = stableSessionId;

    const title = currentSession?.id === stableSessionId ? currentSession.title : null;
    const updatedAt = Date.now();
    const messageCount = agent.state.messages.length;

    setCurrentSession(prev => {
      if (!prev || prev.id !== stableSessionId) return prev;
      return {
        ...prev,
        status,
        updatedAt,
        messageCount,
        title: prev.title || extractSessionTitleFromMessages(agent.state.messages),
      };
    });

    void sessionManager
      .saveSession(stableSessionId, agent.state.messages, {
        status,
        model: agent.state.model?.id,
        provider: agent.state.model?.provider,
        ...(title ? { title } : {}),
      })
      .then(() => refreshHistory())
      .catch(() => {});
  }, [agent, refreshHistory, currentSession]);

  useEffect(() => {
    persistCurrentSessionRef.current = persistCurrentSession;
  }, [persistCurrentSession]);

  const restoreSessionToUI = (session: SessionRecord | null): boolean => {
    if (!session) return false;
    setStableSessionId(session.id);
    agent.sessionId = session.id;
    agent.replaceMessages(session.messages);
    setCurrentSession(toSessionView(session));
    dispatch({ type: 'SESSION_RESTORED', lines: toSessionLines(session.messages) });
    return true;
  };

  const showRestoreFailureModal = useCallback((message: string) => {
    dispatch({
      type: 'COMMAND_EXEC',
      op: 'show_modal',
      modal: { kind: 'ask', message, value: '' },
    });
  }, []);

  const restoreSessionById = useCallback(async (sessionId: string): Promise<boolean> => {
    const session = await sessionManager.loadSession(sessionId);
    if (!session) {
      showRestoreFailureModal('Failed to restore session. The selected session could not be loaded.');
      return false;
    }

    return restoreSessionToUI(session);
  }, [showRestoreFailureModal]);

  const ensureSessionForPrompt = (userInput: string): string => {
    const stableSessionId = activeSessionIdRef.current;
    if (stableSessionId) {
      agent.sessionId = stableSessionId;
      if (!currentSession) {
        setCurrentSession({
          id: stableSessionId,
          title: extractSessionTitle(userInput),
          status: 'active',
          updatedAt: Date.now(),
          messageCount: Math.max(1, agent.state.messages.length),
        });
      }
      return stableSessionId;
    }

    const newSessionId = createSessionId();
    setStableSessionId(newSessionId);
    agent.sessionId = newSessionId;
    setCurrentSession({
      id: newSessionId,
      title: extractSessionTitle(userInput),
      status: 'active',
      updatedAt: Date.now(),
      messageCount: 1,
    });
    return newSessionId;
  };

  const runPrompt = (cmd: string) => {
    dispatch({ type: 'COMMAND_EXEC', op: 'append_user_line', text: `❯ ${cmd}` });
    setCurrentSession(prev => prev ? {
      ...prev,
      status: 'active',
      updatedAt: Date.now(),
      messageCount: prev.messageCount + 1,
    } : prev);

    agent.prompt(cmd).catch(err => {
      lastTurnStatusRef.current = 'error';
      dispatch({ type: 'AGENT_EVENT', op: 'agent_end' });
      dispatch({ type: 'AGENT_EVENT', op: 'error', message: err.message || 'Request failed' });
      dispatch({ type: 'COMMAND_EXEC', op: 'append_system_line', text: `Error: ${err.message}` });
      persistCurrentSessionRef.current('error');
    });
  };

  const commandHandlers: Record<string, () => void> = useMemo(() => ({
    '/clear': () => dispatch({ type: 'COMMAND_EXEC', op: 'clear' }),
    '/new': () => {
      persistCurrentSession('completed');
      setStableSessionId(null);
      agent.sessionId = undefined as any;
      agent.replaceMessages([]);
      setCurrentSession(null);
      dispatch({ type: 'COMMAND_EXEC', op: 'clear' });
      dispatch({ type: 'COMMAND_EXEC', op: 'goto_welcome' });
      void refreshHistory();
    },
    '/help': () => {
      const helpText = SLASH_COMMANDS.map(c => `${c.name.padEnd(12)} - ${c.description}`).join('\n');
      dispatch({
        type: 'COMMAND_EXEC',
        op: 'show_modal',
        modal: { kind: 'ask', message: `Available Commands:\n\n${helpText}`, value: '' },
      });
    },
    '/model': () => {
      modelConfig.startConfig();
      dispatch({ type: 'INPUT_KEY', op: 'clear_value' });
    },
    '/history': () => {
      void (async () => {
        const history = await sessionManager.getHistory(50);
        setHistoryItems(history);
        dispatch({
          type: 'COMMAND_EXEC',
          op: 'show_modal',
          modal: {
            kind: 'selectOne',
            message: 'Sessions',
            choices: history.length > 0
              ? history.map(session => `${session.title} (${session.id.slice(0, 8)}) · ${session.status} · ${session.messageCount} msgs`)
              : ['No history sessions found'],
            selected: 0,
          },
        });
      })();
    },
    '/resume': () => {
      void (async () => {
        const latestId = await sessionManager.getLatestSessionId();
        if (latestId) {
          if (await restoreSessionById(latestId)) {
            dispatch({ type: 'INPUT_KEY', op: 'clear_value' });
            return;
          }
        }

        showRestoreFailureModal('No previous sessions found.');
      })();
    },
  }), [modelConfig, refreshHistory, persistCurrentSession, agent, setStableSessionId, restoreSessionById, showRestoreFailureModal]);

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
    if (!isModelConfigured) {
      modelConfig.startConfig(cmd);
      dispatch({ type: 'INPUT_KEY', op: 'clear_value' });
      return;
    }

    ensureSessionForPrompt(cmd);
    runPrompt(cmd);
  };

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

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
          lastTurnStatusRef.current = 'active';
          setCurrentSession(prev => prev ? { ...prev, status: 'active', updatedAt: Date.now() } : prev);
          dispatch({ type: 'AGENT_EVENT', op: 'agent_start' });
          break;
        case 'agent_end': {
          if (isRawModeSupported) setRawMode(true);
          const finalStatus = lastTurnStatusRef.current === 'error' ? 'error' : 'completed';
          dispatch({ type: 'AGENT_EVENT', op: 'agent_end' });
          setCurrentSession(prev => prev ? {
            ...prev,
            status: finalStatus,
            updatedAt: Date.now(),
            messageCount: agent.state.messages.length,
          } : prev);
          persistCurrentSessionRef.current(finalStatus);
          break;
        }
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
          if (isRawModeSupported) setRawMode(true);
          const msg = event.message as any;
          if (msg.stopReason === 'error' && msg.errorMessage) {
            lastTurnStatusRef.current = 'error';
            setCurrentSession(prev => prev ? { ...prev, status: 'error', updatedAt: Date.now() } : prev);
            dispatch({ type: 'AGENT_EVENT', op: 'error', message: msg.errorMessage });
          } else {
            lastTurnStatusRef.current = 'completed';
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
  }, [agent, isRawModeSupported, setRawMode]);

  useEffect(() => {
    dispatch({ type: 'MODEL_CONFIG_EVENT', op: 'sync_modal', modal: modelConfig.pendingModal });
  }, [modelConfig.pendingModal]);

  useEffect(() => {
    if (
      !modelConfig.isActive &&
      modelConfig.pendingCommand &&
      state.pendingCommandAfterConfig !== modelConfig.pendingCommand
    ) {
      const cmd = modelConfig.pendingCommand;
      dispatch({ type: 'MODEL_CONFIG_EVENT', op: 'remember_pending_command', command: cmd });
      ensureSessionForPrompt(cmd);
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

  const updateModalSelection = (nextSelected: number) => {
    if (state.modal.kind !== 'selectOne') return;
    dispatch({
      type: 'COMMAND_EXEC',
      op: 'show_modal',
      modal: { ...state.modal, selected: nextSelected },
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

    if (focusOwner === 'exitConfirm') {
      hideExitPrompt();
      return true;
    }

    if (focusOwner === 'modelConfig') {
      modelConfig.cancelConfig();
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
      return true;
    }

    if (focusOwner === 'modal') {
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
      return true;
    }

    return false;
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

  const handleModalInput = (key: any): boolean => {
    if (state.modal.kind === 'none') return false;

    if (state.modal.kind === 'selectOne') {
      if (key.upArrow) {
        updateModalSelection(Math.max(0, state.modal.selected - 1));
        return true;
      }

      if (key.downArrow) {
        updateModalSelection(Math.min(state.modal.choices.length - 1, state.modal.selected + 1));
        return true;
      }

      if (key.return) {
        if ((state.modal.message || '').includes('Sessions')) {
          const sessionInfo = historyItems[state.modal.selected];
          if (sessionInfo) {
            void (async () => {
              await restoreSessionById(sessionInfo.id);
            })();
          } else {
            showRestoreFailureModal('Failed to restore session. The selected session is no longer available.');
          }
        }
        dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
        return true;
      }
    }

    if ((state.modal.kind === 'ask' || state.modal.kind === 'confirm') && key.return) {
      dispatch({ type: 'COMMAND_EXEC', op: 'hide_modal' });
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

    switch (focusOwner) {
      case 'exitConfirm':
        return;
      case 'modelConfig':
        handleModelConfigInput(input, key);
        return;
      case 'modal':
        handleModalInput(key);
        return;
      case 'slash':
        if (handleSlashInput(key)) return;
        handleRegularInput(input, key);
        return;
      case 'mainInput':
        handleRegularInput(input, key);
        return;
    }
  });

  const isDimmed = hasModal || modelConfig.isActive;

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
              modelName={modelId}
              cwd={cwd}
              isDimmed={isDimmed}
              exitPromptVisible={state.exitPromptVisible}
              thinking={state.thinking}
              usage={state.usage}
            />
          </WelcomePage>
        ) : (
          <ChatPage lines={state.lines} isDimmed={isDimmed} session={currentSession} />
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
            modelName={modelId}
            cwd={cwd}
            isDimmed={isDimmed}
            exitPromptVisible={state.exitPromptVisible}
            thinking={state.thinking}
            usage={state.usage}
          />
        </Box>
      )}
      <ModalOverlay modal={state.modal} columns={columns} rows={rows} />
    </Box>
  );
}
