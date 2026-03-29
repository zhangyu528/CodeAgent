import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Text, useInput, useApp, useStdout, useStdin } from 'ink';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';
import { WelcomePage, ChatPage } from './components/pages/index.js';
import { DebugPanel } from './components/DebugPanel.js';
import { ChatMessage, ChatSessionInfo } from './components/pages/types.js';
import { InputArea } from './components/inputs/index.js';
import { ModalOverlay } from './components/overlays/index.js';
import { sessionManager, SessionInfo, SessionRecord, SessionStatus } from '../../../core/pi/sessions.js';
import { useModelConfig } from './hooks/useModelConfig.js';
import { createInitialState, piAppReducer } from './state/pi_app_reducer.js';
import {
  SLASH_COMMANDS,
  FocusOwner,
  createSessionId,
  extractSessionTitle,
  extractSessionTitleFromMessages,
  toSessionView,
  toSessionMessages,
  fromChatMessagesToAgentMessages,
} from './pi_app/utils.js';

export type PiInkAppProps = {
  agent: Agent;
  onExit: () => void;
};

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
  const [isInitializing, setIsInitializing] = useState(true);  // 启动初始化状态
  const isDev = process.env.NODE_ENV !== 'production';
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false); // 默认关闭
  const activeSessionIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const reducerMessagesRef = useRef<any[]>([]);
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
  const chatAvailableRows = rows;
  const chatScrollEnabled = state.page === 'chat' && focusOwner === 'mainInput';

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

  const isFirstHistoryLoadRef = useRef(true);
  const refreshHistory = useCallback(async (limit?: number) => {
    const history = await sessionManager.getHistory(limit ?? 50);
    setHistoryItems(history);
    // 首次加载完成后，标记初始化完成
    if (isFirstHistoryLoadRef.current) {
      isFirstHistoryLoadRef.current = false;
      setIsInitializing(false);
    }
  }, []);

  const persistCurrentSession = useCallback((status: SessionStatus = 'completed', messagesToSave?: any[]) => {
    const stableSessionId = activeSessionIdRef.current;
    if (!stableSessionId) return;

    // Debounce: 500ms 内只保存一次
    if (saveTimeoutRef.current) return;
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
    }, 500);

    // 如果正在保存，跳过
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    agent.sessionId = stableSessionId;

    const title = currentSession?.id === stableSessionId ? currentSession.title : null;
    const updatedAt = Date.now();
    const messagesToUse = messagesToSave || reducerMessagesRef.current;
    const messageCount = messagesToUse.length;

    // Get agent messages - agent.state.messages should be complete at agent_end
    const agentMessages = messagesToSave ? fromChatMessagesToAgentMessages(messagesToUse) : agent.state.messages;

    setCurrentSession(prev => {
      if (!prev || prev.id !== stableSessionId) return prev;
      return {
        ...prev,
        status,
        updatedAt,
        messageCount,
        title: prev.title || extractSessionTitleFromMessages(messagesToUse),
      };
    });

    void sessionManager
      .saveSession(stableSessionId, agentMessages, {
        status,
        model: agent.state.model?.id,
        provider: agent.state.model?.provider,
        ...(title ? { title } : {}),
      })
      .then(() => {
        isSavingRef.current = false;
        refreshHistory();
      })
      .catch((err) => {
        isSavingRef.current = false;
      });
  }, [agent, refreshHistory, currentSession]);

  useEffect(() => {
    persistCurrentSessionRef.current = persistCurrentSession;
  }, [persistCurrentSession]);

  // Keep reducerMessagesRef in sync with state.messages
  useEffect(() => {
    reducerMessagesRef.current = state.messages;
  }, [state.messages]);

  const restoreSessionToUI = (session: SessionRecord | null): boolean => {
    if (!session) return false;
    setStableSessionId(session.id);
    agent.sessionId = session.id;
    agent.replaceMessages(session.messages);
    setCurrentSession(toSessionView(session));
    dispatch({ type: 'SESSION_RESTORED', messages: toSessionMessages(session.messages) });
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
          messageCount: Math.max(1, reducerMessagesRef.current.length),
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
    dispatch({ type: 'COMMAND_EXEC', op: 'append_user_message', text: cmd });
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
      dispatch({ type: 'COMMAND_EXEC', op: 'append_error_message', text: err.message });
      persistCurrentSessionRef.current('error');
    });
  };

  const commandHandlers: Record<string, () => void> = useMemo(() => ({
    '/clear': () => dispatch({ type: 'COMMAND_EXEC', op: 'clear' }),
    '/new': () => {
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
        await refreshHistory(50);  // 加载完整列表
        dispatch({
          type: 'COMMAND_EXEC',
          op: 'show_modal',
          modal: {
            kind: 'selectOne',
            message: 'Sessions',
            choices: historyItems.length > 0
              ? historyItems.map(session => `${session.title} (${session.id.slice(0, 8)}) · ${session.status} · ${session.messageCount} msgs`)
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
    '/quit': () => {
      onExit();
    },
  }), [modelConfig, refreshHistory, persistCurrentSession, agent, setStableSessionId, restoreSessionById, showRestoreFailureModal, onExit]);

  const executeCommand = (cmdName: string) => {
    const cmd = cmdName.trim();

    const handler = commandHandlers[cmd];
    if (handler) {
      handler();
      return;
    }

    if (cmd.startsWith('/')) {
      dispatch({ type: 'COMMAND_EXEC', op: 'append_system_message', text: `Unknown command: ${cmd}` });
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
    void refreshHistory(1);  // 启动时只加载1条，用于 /resume
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
            messageCount: reducerMessagesRef.current.length,
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
          } else if (assistantEvent.type === 'reasoning_delta') {
            dispatch({ type: 'AGENT_EVENT', op: 'reasoning_delta', delta: assistantEvent.delta });
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
          // Don't persist here - wait for agent_end when all messages are complete
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
    // Ctrl+P toggles debug panel
    if (key.ctrl && input === 'p') {
      setIsDebugVisible(prev => !prev);
      return;
    }

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
        {isInitializing ? (
          <Box justifyContent="center" alignItems="center">
            <Text color="cyan">Loading...</Text>
          </Box>
        ) : state.page === 'welcome' ? (
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
          <ChatPage
            messages={state.messages}
            availableRows={chatAvailableRows}
            scrollEnabled={chatScrollEnabled}
            isDimmed={isDimmed}
            session={currentSession}
            inputValue={state.inputValue}
            slashVisible={isSlashVisible}
            slashItems={filteredCommands}
            slashSelected={state.slashSelected}
            modelName={modelId}
            cwd={cwd}
            exitPromptVisible={state.exitPromptVisible}
            thinking={state.thinking}
            usage={state.usage}
          />
        )}
      </Box>
      <ModalOverlay modal={state.modal} columns={columns} rows={rows} />
      {isDev && <DebugPanel messages={debugMessages} isVisible={isDebugVisible} />}
    </Box>
  );
}
