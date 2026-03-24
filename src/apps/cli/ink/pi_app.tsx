import React, { useEffect, useState, useMemo } from 'react';
import { Box, useInput, useApp, useStdout } from 'ink';
import { Agent, AgentEvent } from '@mariozechner/pi-agent-core';
import { WelcomePage } from './components/welcome_page.js';
import { ChatPage } from './components/chat_page.js';
import { InputArea } from './components/input_area.js';
import { ChoicePrompt } from './components/types.js';
import { PromptOverlay } from './components/prompt_overlay.js';
import { sessionManager } from '../../../core/pi/sessions.js';

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

const SUPPORTED_MODELS = [
  { label: '[GLM] glm-4-flash', id: 'glm-4-flash', provider: 'glm', api: 'openai-responses', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/' },
  { label: '[GLM] glm-4', id: 'glm-4', provider: 'glm', api: 'openai-responses', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/' },
  { label: '[Minimax] abab6.5-chat', id: 'abab6.5-chat', provider: 'minimax', api: 'openai-responses', baseUrl: 'https://api.minimax.chat/v1/' },
  { label: '[OpenAI] gpt-4o', id: 'gpt-4o', provider: 'openai', api: 'openai-responses' },
  { label: '[OpenAI] gpt-4o-mini', id: 'gpt-4o-mini', provider: 'openai', api: 'openai-responses' },
  { label: '[Anthropic] claude-3-5-sonnet', id: 'claude-3-5-sonnet-20240620', provider: 'anthropic', api: 'anthropic-messages' },
];

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
  const [lines, setLines] = useState<Array<{ id: string; text: string }>>([]);
  const [thinking, setThinking] = useState(false);
  const [prompt, setPrompt] = useState<ChoicePrompt>({ kind: 'none' });
  
  // UI state
  const [slashSelected, setSlashSelected] = useState(0);
  const isSlashVisible = inputValue.startsWith('/') && !inputValue.includes(' ');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historySelected, setHistorySelected] = useState(0);
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  
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
        case 'agent_start': setThinking(true); break;
        case 'agent_end':
          setThinking(false);
          if (agent.sessionId) sessionManager.saveSession(agent.sessionId, agent.state.messages);
          break;
        case 'message_update':
          const assistantEvent = event.assistantMessageEvent;
          if (assistantEvent.type === 'text_delta') {
            setThinking(false);
            const delta = assistantEvent.delta;
            setLines(prev => {
              if (prev.length === 0) return [{ id: '0', text: delta }];
              const last = prev[prev.length - 1];
              if (!last) return [{ id: '0', text: delta }];
              return [...prev.slice(0, -1), { id: last.id, text: last.text + delta }];
            });
          }
          break;
        case 'tool_execution_start':
          setLines(prev => [...prev, { id: Date.now().toString(), text: `[Tool: ${event.toolName}] ${JSON.stringify(event.args)}` }]);
          break;
        case 'tool_execution_end':
          setLines(prev => [...prev, { id: Date.now().toString(), text: `[Result: ${event.toolName}] ${event.isError ? 'Failed' : 'Success'}` }]);
          break;
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
        setPrompt({ kind: 'selectOne', message: 'Select Model', choices: SUPPORTED_MODELS.map(m => m.label), selected: 0 });
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
                    text: m.role === 'user' ? `❯ ${m.content}` : m.content
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
                if (prompt.message.includes('Model')) {
                    const selectedModel = SUPPORTED_MODELS[selectedIndex];
                    if (selectedModel) {
                        agent.setModel({ id: selectedModel.id, name: selectedModel.id, provider: selectedModel.provider, api: selectedModel.api, baseUrl: selectedModel.baseUrl } as any);
                    }
                }
                if (prompt.message.includes('Sessions')) {
                    const sessionInfo = sessionManager.getHistory()[selectedIndex];
                    if (sessionInfo) {
                        const session = sessionManager.loadSession(sessionInfo.id);
                        if (session) {
                            agent.sessionId = session.id;
                            agent.replaceMessages(session.messages);
                            setLines(session.messages.map((m: any, i: number) => ({ id: m.id || `restored-${i}`, text: m.role === 'user' ? `❯ ${m.content}` : m.content })));
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
                    setLines(session.messages.map((m: any, i: number) => ({ id: m.id || `restored-${i}`, text: m.role === 'user' ? `❯ ${m.content}` : m.content })));
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
