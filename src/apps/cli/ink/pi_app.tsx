import React, { useEffect, useState, useMemo } from 'react';
import { Box, useInput, useApp, useStdout } from 'ink';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';
import { WelcomePage } from './components/welcome_page.js';
import { ChatPage } from './components/chat_page.js';
import { InputArea } from './components/input_area.js';
import { ChoicePrompt } from './components/types.js';
import { PromptOverlay } from './components/prompt_overlay.js';
import { sessionManager } from '../../../core/pi/sessions.js';
import { getModels, getProviders } from '@mariozechner/pi-ai';

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

// Group models by provider for two-step selection
const PROVIDERS = getProviders();
const MODELS_BY_PROVIDER: Record<string, ReturnType<typeof getModels>> = {};
for (const p of PROVIDERS) {
  MODELS_BY_PROVIDER[p] = getModels(p);
}

// Provider overrides for correct baseUrl/api
const PROVIDER_OVERRIDES: Record<string, { baseUrl?: string; api?: string }> = {
  minimax: { baseUrl: 'https://api.minimaxi.com/v1', api: 'openai-completions' },
};

export function PiInkApp({ agent, onExit }: PiInkAppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    columns: stdout.columns || 80,
    rows: stdout.rows || 24
  });

  const { columns, rows } = dimensions;
  const [page, setPage] = useState<'welcome' | 'chat'>('welcome');
  const [inputValue, setInputValue] = useState('');
  const [lines, setLines] = useState<Array<{ id: string; text: string; isAssistant?: boolean }>>([]);
  const [thinking, setThinking] = useState(false);
  const [prompt, setPrompt] = useState<ChoicePrompt>({ kind: 'none' });
  const [usage, setUsage] = useState<{ input: number; output: number; cost: number } | null>(null);
  
  // UI state
  const [slashSelected, setSlashSelected] = useState(0);
  const isSlashVisible = inputValue.startsWith('/') && !inputValue.includes(' ');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historySelected, setHistorySelected] = useState(0);
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const [modelSelectProvider, setModelSelectProvider] = useState<string | null>(null);
  
  const historyItems = useMemo(() => sessionManager.getHistory(), [historyVisible, page]);
  const filteredCommands = useMemo(() => {
    if (!isSlashVisible) return [];
    return SLASH_COMMANDS.filter(c => c.name.startsWith(inputValue));
  }, [inputValue, isSlashVisible]);

  const cwd = useMemo(() => process.cwd(), []);
  const provider = agent.state.model?.provider || 'unknown';
  const modelId = agent.state.model?.id || 'unknown';
  const version = '1.0.0';

  useEffect(() => {
    const handleResize = () => setDimensions({ columns: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on('resize', handleResize);
    return () => { stdout.off('resize', handleResize); };
  }, [stdout]);

  useEffect(() => {
    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'agent_start': 
          setThinking(true); 
          setUsage(null);
          break;
        case 'agent_end':
          setThinking(false);
          if (agent.sessionId) sessionManager.saveSession(agent.sessionId, agent.state.messages);
          break;
        case 'message_update': {
          const assistantEvent = event.assistantMessageEvent;
          if (assistantEvent.type === 'text_delta') {
            setThinking(false);
            const delta = assistantEvent.delta;
            setLines(prev => {
              if (prev.length === 0) return [{ id: 'ai-response', text: delta, isAssistant: true }];
              const last = prev[prev.length - 1];
              if (last && last.isAssistant) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
              }
              return [...prev, { id: `ai-${Date.now()}`, text: delta, isAssistant: true }];
            });
          } else if (assistantEvent.type === 'thinking_delta') {
            setThinking(true);
            const delta = assistantEvent.delta;
            setLines(prev => {
              const last = prev[prev.length - 1];
              if (last && last.id.startsWith('thinking-')) {
                return [...prev.slice(0, -1), { id: last.id, text: last.text + delta }];
              }
              return [...prev, { id: `thinking-${Date.now()}`, text: `[Thinking] ${delta}` }];
            });
          }
          break;
        }
        case 'message_end': {
          const msg = event.message as any;
          // Check for error in message
          if (msg.stopReason === 'error' && msg.errorMessage) {
            setLines(prev => [...prev, { id: `error-${Date.now()}`, text: `[Error] ${msg.errorMessage}`, isAssistant: true }]);
          }
          if (msg.usage) {
            setUsage({
              input: msg.usage.inputTokens || msg.usage.input || 0,
              output: msg.usage.outputTokens || msg.usage.output || 0,
              cost: msg.usage.cost?.total || 0,
            });
          }
          break;
        }
      }
    });
    return () => unsubscribe();
  }, [agent]);

  const executeCommand = (cmdName: string) => {
    const cmd = cmdName.trim();
    if (cmd === '/clear') { setLines([]); setInputValue(''); return; }
    if (cmd === '/new') { setPage('welcome'); setInputValue(''); return; }
    if (cmd === '/help') {
      const helpText = SLASH_COMMANDS.map(c => `${c.name.padEnd(12)} - ${c.description}`).join('\n');
      setPrompt({ kind: 'ask', message: `Available Commands:\n\n${helpText}`, value: '' });
      setInputValue('');
      return;
    }
    if (cmd === '/model') {
        setModelSelectProvider(null);
        setPrompt({ kind: 'selectOne', message: 'Select Provider', choices: PROVIDERS.map(p => p.toUpperCase()), selected: 0 });
        setInputValue('');
        return;
    }
    if (cmd === '/history') { setHistoryVisible(true); setHistorySelected(0); setInputValue(''); return; }
    if (cmd === '/resume') {
        const latestId = sessionManager.getLatestSessionId();
        if (latestId) {
            const session = sessionManager.loadSession(latestId);
            if (session) {
                agent.sessionId = session.id;
                agent.replaceMessages(session.messages);
                setLines(session.messages.map((m: any, i: number) => ({
                    id: m.id || `restored-${i}`,
                    text: m.role === 'user' ? `❯ ${m.content}` : m.content,
                    isAssistant: m.role === 'assistant'
                })));
                setPage('chat'); setInputValue(''); return;
            }
        }
        setPrompt({ kind: 'ask', message: 'No previous sessions found.', value: '' });
        setInputValue('');
        return;
    }

    if (cmd.startsWith('/')) {
        setLines(prev => [...prev, { id: `sys-err-${Date.now()}`, text: `Unknown command: ${cmd}` }]);
        setPage('chat'); setInputValue(''); return;
    }

    if (thinking) return;
    setPage('chat');
    setLines(prev => [...prev, { id: `u-${Date.now()}`, text: `❯ ${cmd}` }]);
    setInputValue('');
    agent.prompt(cmd).catch(err => setLines(prev => [...prev, { id: `e-${Date.now()}`, text: `Error: ${err.message}` }]));
  };

  useInput((input, key) => {
    const isExitKey = (key.ctrl && (input === 'c' || input === 'd')) || input === '\u0003' || input === '\u0004';

    if (isExitKey) {
      if (exitPromptVisible) { onExit(); exit(); return; }
      setExitPromptVisible(true);
      setTimeout(() => setExitPromptVisible(false), 3000);
      return;
    }

    if (key.escape) {
      if (exitPromptVisible) { setExitPromptVisible(false); return; }
      if (prompt.kind !== 'none') { setPrompt({ kind: 'none' }); return; }
      if (historyVisible) { setHistoryVisible(false); return; }
      return;
    }

    if (exitPromptVisible) setExitPromptVisible(false);

    // Modal Prompts
    if (prompt.kind !== 'none') {
        if (prompt.kind === 'selectOne') {
            if (key.upArrow) { setPrompt(prev => prev.kind === 'selectOne' ? { ...prev, selected: Math.max(0, prev.selected - 1) } : prev); return; }
            if (key.downArrow) { setPrompt(prev => prev.kind === 'selectOne' ? { ...prev, selected: Math.min(prev.choices.length - 1, prev.selected + 1) } : prev); return; }
            if (key.return) {
                const selectedIndex = (prompt as any).selected;
                if (prompt.message.includes('Provider')) {
                    // First step: selected provider, now show models
                    const selectedProvider = PROVIDERS[selectedIndex];
                    if (!selectedProvider) { setPrompt({ kind: 'none' }); return; }
                    const providerModels = MODELS_BY_PROVIDER[selectedProvider];
                    if (!providerModels) { setPrompt({ kind: 'none' }); return; }
                    setModelSelectProvider(selectedProvider);
                    setPrompt({ kind: 'selectOne', message: `Select Model (${selectedProvider.toUpperCase()})`, choices: providerModels.map((m: any) => m.id), selected: 0 });
                    return;
                }
                if (prompt.message.includes('Model')) {
                    // Second step: selected model, apply it
                    const provider = modelSelectProvider!;
                    const models = MODELS_BY_PROVIDER[provider];
                    if (!models) { setPrompt({ kind: 'none' }); return; }
                    const selectedModel = models[selectedIndex];
                    if (selectedModel) {
                        agent.setModel({
                            id: selectedModel.id,
                            name: selectedModel.id,
                            provider: selectedModel.provider,
                            api: selectedModel.api as any,
                            baseUrl: selectedModel.baseUrl
                        } as any);
                    }
                    setModelSelectProvider(null);
                }
                if (prompt.message.includes('Sessions')) {
                    const sessionInfo = sessionManager.getHistory()[selectedIndex];
                    if (sessionInfo) {
                        const session = sessionManager.loadSession(sessionInfo.id);
                        if (session) {
                            agent.sessionId = session.id;
                            agent.replaceMessages(session.messages);
                            setLines(session.messages.map((m: any, i: number) => ({ 
                                id: m.id || `restored-${i}`, 
                                text: m.role === 'user' ? `❯ ${m.content}` : m.content,
                                isAssistant: m.role === 'assistant'
                            })));
                            setPage('chat');
                        }
                    }
                }
                setPrompt({ kind: 'none' }); return;
            }
        }
        if (prompt.kind === 'ask' || prompt.kind === 'confirm') { if (key.return) { setPrompt({ kind: 'none' }); return; } }
        return;
    }

    // History
    if (historyVisible) {
        if (key.upArrow) { setHistorySelected(prev => Math.max(0, prev - 1)); return; }
        if (key.downArrow) { setHistorySelected(prev => Math.min(historyItems.length - 1, prev + 1)); return; }
        if (key.return) {
            const selected = historyItems[historySelected];
            if (selected) {
                const session = sessionManager.loadSession(selected.id);
                if (session) {
                    agent.sessionId = session.id;
                    agent.replaceMessages(session.messages);
                    setLines(session.messages.map((m: any, i: number) => ({ 
                        id: m.id || `restored-${i}`, 
                        text: m.role === 'user' ? `❯ ${m.content}` : m.content,
                        isAssistant: m.role === 'assistant'
                    })));
                    setPage('chat');
                }
            }
            setHistoryVisible(false); return;
        }
        return;
    }

    // Slash
    if (isSlashVisible) {
        if (key.upArrow) { setSlashSelected(prev => Math.max(0, prev - 1)); return; }
        if (key.downArrow) { setSlashSelected(prev => Math.min(filteredCommands.length - 1, prev + 1)); return; }
        if (key.tab || (key.return && filteredCommands[slashSelected])) {
            const selected = filteredCommands[slashSelected];
            if (selected) { if (key.tab) setInputValue(selected.name); else executeCommand(selected.name); return; }
        }
    }

    if (key.return) { executeCommand(inputValue); return; }
    if (key.backspace || key.delete) { setInputValue(prev => prev.slice(0, -1)); setSlashSelected(0); return; }
    if (!key.ctrl && !key.meta && input) { setInputValue(prev => prev + input); setSlashSelected(0); }
  });

  const isDimmed = prompt.kind !== 'none';

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Box flexGrow={1} flexDirection="column">
        {page === 'welcome' ? (
          <WelcomePage version={version} cwd={cwd} provider={provider} logs={[]} rows={rows} cols={columns} isDimmed={isDimmed}>
            <InputArea value={inputValue} page={page} slashVisible={isSlashVisible} slashItems={filteredCommands} slashSelected={slashSelected} historyVisible={historyVisible} historyItems={historyItems} historySelected={historySelected} modelName={modelId} cwd={cwd} isDimmed={isDimmed} exitPromptVisible={exitPromptVisible} />
          </WelcomePage>
        ) : (
          <ChatPage lines={lines} isDimmed={isDimmed} />
        )}
      </Box>
      {page === 'chat' && (
        <Box flexShrink={0}>
          <InputArea value={inputValue} page={page} slashVisible={isSlashVisible} slashItems={filteredCommands} slashSelected={slashSelected} historyVisible={historyVisible} historyItems={historyItems} historySelected={historySelected} modelName={modelId} cwd={cwd} isDimmed={isDimmed} exitPromptVisible={exitPromptVisible} />
        </Box>
      )}
      <PromptOverlay prompt={prompt} columns={columns} rows={rows} />
    </Box>
  );
}
