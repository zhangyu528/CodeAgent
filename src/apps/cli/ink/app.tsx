import React, { useEffect, useMemo, useRef, useState } from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { Box, Text, useApp, useInput } from 'ink';
import { AgentController } from '../../../core/controller/agent_controller';
import { LLMEngine } from '../../../core/llm/engine';
import { TelemetryMonitor } from '../../../utils/logger';
import { Message } from '../../../core/llm/provider';
import { SlashCommandDef, dispatchSlash, getBestMatch, parseSlash } from '../components/slash_commands';
import { InkUIAdapter } from './ink_ui_adapter';
import { SessionCoordinator } from './session_coordinator';
import { PageState, RecentSessionItem } from './types';
import { ChatHeader, ChatPage, InputArea, InputBar, PromptBox, SelectList, SelectManyList, WelcomePage } from './components/ui_blocks';

type ChatLine = { id: string; text: string };

type PromptState =
  | { kind: 'none' }
  | { kind: 'ask'; message: string; value: string; resolve: (v: string) => void }
  | { kind: 'confirm'; message: string; resolve: (v: boolean) => void }
  | { kind: 'selectOne'; message: string; choices: string[]; selected: number; resolve: (v: string) => void }
  | { kind: 'selectMany'; message: string; choices: string[]; selected: number; picked: Set<number>; resolve: (v: string[]) => void };

export type InkAppProps = {
  controller: AgentController;
  engine: LLMEngine;
  commands: SlashCommandDef[];
  telemetry: TelemetryMonitor;
  uiAdapter: InkUIAdapter;
  onExit: () => void;
};

function getCliVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return String(pkg?.version || 'unknown');
  } catch {
    return 'unknown';
  }
}

function mkLine(text: string): ChatLine {
  return { id: `${Date.now()}-${Math.random()}`, text };
}

function replayToLines(replay: Array<{ role: string; content?: string }>): ChatLine[] {
  const lines: ChatLine[] = [];
  for (const m of replay) {
    if (!m.content) continue;
    if (m.role === 'user') lines.push(mkLine(`❯ ${m.content}`));
    else if (m.role === 'assistant') lines.push(mkLine(m.content));
    else if (m.role === 'tool') lines.push(mkLine(`[tool] ${m.content}`));
  }
  return lines;
}

export function InkApp(props: InkAppProps) {
  const { exit } = useApp();
  const coordinatorRef = useRef(new SessionCoordinator(props.controller));
  const pageRef = useRef<PageState>('welcome');
  const abortRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  const [pageState, setPageState] = useState<PageState>('welcome');
  const [inputValue, setInputValue] = useState('');
  const [processing, setProcessing] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState('New Session');

  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [welcomeLogs, setWelcomeLogs] = useState<string[]>([]);

  const [recentSessions, setRecentSessions] = useState<RecentSessionItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySelected, setHistorySelected] = useState(0);

  const [slashSelected, setSlashSelected] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [promptState, setPromptState] = useState<PromptState>({ kind: 'none' });
  const [termSize, setTermSize] = useState({
    rows: process.stdout.rows || 40,
    cols: process.stdout.columns || 120,
  });

  const cmdChoices = useMemo(() => {
    const v = inputValue.trim();
    if (slashDismissed || !v.startsWith('/') || v.includes(' ')) return [];
    const parsed = parseSlash(v);
    const prefix = parsed?.name || '/';
    return props.commands
      .filter((c) => c.name.startsWith(prefix))
      .map((c) => ({ 
        name: c.name, 
        description: c.description,
        category: c.category,
        usage: c.usage
      }));
  }, [inputValue, props.commands, slashDismissed]);

  const slashVisible = cmdChoices.length > 0;

  const appendLine = (line: string) => {
    if (pageRef.current === 'chat') {
      setChatLines((prev) => [...prev, mkLine(line)]);
    } else {
      setWelcomeLogs((prev) => [...prev.slice(-7), line]);
    }
  };

  const appendStream = (token: string) => {
    if (pageRef.current !== 'chat') return;
    setChatLines((prev) => {
      if (prev.length === 0) return [mkLine(token)];
      const next = prev.slice();
      const last = next[next.length - 1]!;
      next[next.length - 1] = { ...last, text: `${last.text}${token}` };
      return next;
    });
  };

  const reloadRecent = () => {
    const rows = coordinatorRef.current.listRecent(10);
    setRecentSessions(rows);
    setHistorySelected(0);
  };

  const returnToWelcome = () => {
    console.clear();
    pageRef.current = 'welcome';
    setPageState('welcome');
    setCurrentSessionId(null);
    setCurrentSessionTitle('New Session');
    currentSessionIdRef.current = null;
    setChatLines([]);
    setHistoryOpen(false);
    setWelcomeLogs((prev) => prev.slice(-7));
    reloadRecent();
  };

  const openChat = (title: string, sessionId: string | null, clearOutput: boolean) => {
    pageRef.current = 'chat';
    setPageState('chat');
    setCurrentSessionTitle((title || 'New Session').trim() || 'New Session');
    setCurrentSessionId(sessionId);
    currentSessionIdRef.current = sessionId;
    if (clearOutput) setChatLines([]);
  };

  const openNewSession = (initialPrompt: string) => {
    const created = coordinatorRef.current.startFromWelcome(initialPrompt);
    openChat(created.title, created.sessionId, true);
  };

  const resumeSession = (sessionId: string, title: string) => {
    const resumed = coordinatorRef.current.resumeFromWelcome(sessionId);
    openChat(title, resumed.sessionId, true);
    setChatLines(replayToLines(resumed.replay as Array<{ role: string; content?: string }>));
    setChatLines((prev) => [...prev, mkLine(`[Resumed] ${title}`)]);
  };

  const endAndExit = async () => {
    props.controller.endCurrentSession?.();
    props.onExit();
    exit();
  };

  const handleUserPrompt = async (prompt: string) => {
    abortRef.current = new AbortController();
    setChatLines((prev) => [...prev, mkLine('Thinking...')]);
    try {
      const streamOpts: { signal?: AbortSignal; sessionId?: string } = { signal: abortRef.current.signal };
      if (currentSessionIdRef.current) streamOpts.sessionId = currentSessionIdRef.current;
      await props.controller.askStream(prompt, streamOpts);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setChatLines((prev) => [...prev, mkLine('[Interrupted]')]);
      } else {
        setChatLines((prev) => [...prev, mkLine(`Error: ${err?.message || String(err)}`)]);
      }
    } finally {
      abortRef.current = null;
      setChatLines((prev) => [...prev, mkLine('')]);
    }
  };

  const handleSlash = async (line: string) => {
    const selectedItem = cmdChoices[slashSelected] || null;
    const selectedHint = selectedItem?.name || null;
    const bestName = getBestMatch(line, props.commands, selectedHint);

    if (bestName === '/history') {
      reloadRecent();
      setHistoryOpen(true);
      return;
    }

    if (bestName === '/resume') {
      const parsedResume = parseSlash(line);
      const args = parsedResume?.args ?? [];
      if (args.length > 0) {
        appendLine('Usage: /resume');
        return;
      }

      const recent = coordinatorRef.current.listRecent(1);
      if (!recent.length || !recent[0]?.id) {
        appendLine('暂无历史会话。');
        return;
      }

      // Resume 时如果历史浮层打开，先关闭以避免遮挡
      setHistoryOpen(false);
      setHistorySelected(0);
      resumeSession(recent[0].id, recent[0].title);
      return;
    }

    const parsed = parseSlash(line);
    const argsStr = parsed?.args.length ? ` ${parsed.args.join(' ')}` : '';
    const expandedLine = `${bestName}${argsStr}`;

    if (pageRef.current === 'chat' && bestName !== '/new') {
      setChatLines((prev) => [...prev, mkLine(`❯ ${line}`)]);
    }

    if (expandedLine !== line && bestName !== '/new') {
      appendLine(`-> ${expandedLine}`);
    }

    await dispatchSlash({
      controller: props.controller,
      engine: props.engine,
      ui: props.uiAdapter,
      commands: props.commands,
      telemetry: props.telemetry,
      print: (m: string) => appendLine(m),
      info: (m: string) => appendLine(m),
      error: (m: string) => appendLine(m),
      requestExit: () => endAndExit(),
      clearScreen: (showWelcome?: boolean) => {
        if (showWelcome) {
          returnToWelcome();
        } else {
          if (pageRef.current === 'chat') setChatLines([]);
          else setWelcomeLogs([]);
        }
      },
      handleUserPrompt: (p: string) => handleUserPrompt(p),
      onSessionSwitched: (sessionId: string | null, title: string) => {
        openChat(title, sessionId, true);
      },
      getPageState: () => pageRef.current,
      returnToWelcome: () => returnToWelcome(),
      isStreaming: () => Boolean(abortRef.current),
      abortStreaming: () => {
        if (!abortRef.current) return;
        abortRef.current.abort();
        coordinatorRef.current.markInterrupted();
        abortRef.current = null;
      },
    }, expandedLine, props.commands, selectedHint);

    const active = coordinatorRef.current.getCurrentSessionId();
    setCurrentSessionId(active);
    currentSessionIdRef.current = active;
  };

  const handleSubmit = async (raw: string) => {
    const line = raw.trim();
    if (!line || processing) return;
    setProcessing(true);

    try {
      if (line.startsWith('/')) {
        setInputValue(''); // Clear immediately so slash list disappears during interactive prompts
        await handleSlash(line);
      } else {
        if (pageRef.current === 'welcome') {
          openNewSession(line);
        }
        setChatLines((prev) => [...prev, mkLine(`❯ ${line}`)]);
        await handleUserPrompt(line);
      }
    } finally {
      setProcessing(false);
      setSlashSelected(0);
    }
  };

  useEffect(() => {
    reloadRecent();
  }, []);

  useEffect(() => {
    const onResize = () => {
      setTermSize({
        rows: process.stdout.rows || 40,
        cols: process.stdout.columns || 120,
      });
    };
    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (pageState === 'welcome') {
      console.clear();
    }
  }, [pageState]);

  useEffect(() => {
    props.uiAdapter.bind({
      appendLine,
      appendStream,
      requestAsk: (message: string, initial?: string) =>
        new Promise<string>((resolve) => setPromptState({ kind: 'ask', message, value: initial || '', resolve })),
      requestConfirm: (message: string) =>
        new Promise<boolean>((resolve) => setPromptState({ kind: 'confirm', message, resolve })),
      requestSelectOne: (message: string, choices: string[], defaultValue?: string) => {
        const selected = Math.max(0, defaultValue ? choices.indexOf(defaultValue) : 0);
        return new Promise<string>((resolve) =>
          setPromptState({ kind: 'selectOne', message, choices, selected: selected < 0 ? 0 : selected, resolve })
        );
      },
      requestSelectMany: (message: string, choices: string[], defaults?: string[]) => {
        const picked = new Set<number>();
        const df = defaults || [];
        choices.forEach((c, idx) => {
          if (df.includes(c)) picked.add(idx);
        });
        return new Promise<string[]>((resolve) =>
          setPromptState({ kind: 'selectMany', message, choices, selected: 0, picked, resolve })
        );
      },
    });
  }, [props.uiAdapter]);

  useEffect(() => {
    pageRef.current = pageState;
  }, [pageState]);

  useInput((input, key) => {
    if (promptState.kind !== 'none') {
      if (promptState.kind === 'ask') {
        if (key.return) {
          promptState.resolve(promptState.value);
          setPromptState({ kind: 'none' });
          return;
        }
        if (key.escape) {
          promptState.resolve('');
          setPromptState({ kind: 'none' });
          return;
        }
        if (key.backspace || key.delete) {
          setPromptState({ ...promptState, value: promptState.value.slice(0, -1) });
          return;
        }
        if (input) {
          setPromptState({ ...promptState, value: `${promptState.value}${input}` });
        }
        return;
      }

      if (promptState.kind === 'confirm') {
        if (key.return || input.toLowerCase() === 'y') {
          promptState.resolve(true);
          setPromptState({ kind: 'none' });
          return;
        }
        if (input.toLowerCase() === 'n' || key.escape) {
          promptState.resolve(false);
          setPromptState({ kind: 'none' });
        }
        return;
      }

      if (promptState.kind === 'selectOne') {
        if (key.upArrow) {
          setPromptState({ ...promptState, selected: Math.max(0, promptState.selected - 1) });
          return;
        }
        if (key.downArrow) {
          setPromptState({ ...promptState, selected: Math.min(promptState.choices.length - 1, promptState.selected + 1) });
          return;
        }
        if (key.return) {
          promptState.resolve(promptState.choices[promptState.selected] || '');
          setPromptState({ kind: 'none' });
          return;
        }
        if (key.escape) {
          promptState.resolve(promptState.choices[0] || '');
          setPromptState({ kind: 'none' });
        }
        return;
      }

      if (promptState.kind === 'selectMany') {
        if (key.upArrow) {
          setPromptState({ ...promptState, selected: Math.max(0, promptState.selected - 1) });
          return;
        }
        if (key.downArrow) {
          setPromptState({ ...promptState, selected: Math.min(promptState.choices.length - 1, promptState.selected + 1) });
          return;
        }
        if (key.return) {
          const out = [...promptState.picked].sort((a, b) => a - b).map((idx) => promptState.choices[idx]!);
          promptState.resolve(out);
          setPromptState({ kind: 'none' });
          return;
        }
        if (input === ' ') {
          const next = new Set(promptState.picked);
          if (next.has(promptState.selected)) next.delete(promptState.selected);
          else next.add(promptState.selected);
          setPromptState({ ...promptState, picked: next });
          return;
        }
        if (key.escape) {
          promptState.resolve([]);
          setPromptState({ kind: 'none' });
        }
      }
      return;
    }

    if (historyOpen) {
      if (key.upArrow) {
        setHistorySelected((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setHistorySelected((prev) => Math.min(Math.max(0, recentSessions.length - 1), prev + 1));
        return;
      }
      if (key.return) {
        const selected = recentSessions[historySelected];
        if (selected) {
          resumeSession(selected.id, selected.title);
        }
        setHistoryOpen(false);
        setInputValue('');
        return;
      }
      if (key.escape) {
        setHistoryOpen(false);
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'c') {
      if (abortRef.current) {
        abortRef.current.abort();
        coordinatorRef.current.markInterrupted();
        abortRef.current = null;
      } else {
        void endAndExit();
      }
      return;
    }

    if (key.ctrl && input.toLowerCase() === 'd') {
      void endAndExit();
      return;
    }

    if (key.return) {
      void handleSubmit(inputValue);
      return;
    }

    if (key.escape) {
      if (historyOpen) {
        setHistoryOpen(false);
        return;
      } 
      
      if (slashVisible) {
        setSlashDismissed(true);
        return;
      }

      setSlashSelected(0);
      return;
    }

    if (key.tab && slashVisible) {
      const selectedItem = cmdChoices[slashSelected] || cmdChoices[0];
      const next = selectedItem ? selectedItem.name : inputValue;
      setInputValue(`${next} `);
      return;
    }

    if (key.upArrow && slashVisible) {
      setSlashSelected((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow && slashVisible) {
      setSlashSelected((prev) => Math.min(cmdChoices.length - 1, prev + 1));
      return;
    }

    if (key.backspace || key.delete) {
      setInputValue((prev) => {
        const next = prev.slice(0, -1);
        setSlashDismissed(false);
        return next;
      });
      return;
    }

    if (input) {
      setInputValue((prev) => {
        const next = `${prev}${input}`;
        setSlashDismissed(false);
        return next;
      });
    }
  });

  const sharedInputProps = {
    value: inputValue,
    page: pageState,
    slashVisible: slashVisible && !historyOpen,
    slashItems: cmdChoices,
    slashSelected: slashSelected,
    historyVisible: historyOpen,
    historyItems: recentSessions,
    historySelected: historySelected,
    prompt: promptState,
  };

  const shortSessionId = currentSessionId ? currentSessionId.slice(0, 8) : 'new';
  const viewportRows = Math.max(12, termSize.rows - (processing ? 5 : 4) - (pageState === 'chat' ? 2 : 0));

  return (
    <Box flexDirection="column" height={termSize.rows} overflow="hidden">
      {pageState === 'chat' ? <ChatHeader title={currentSessionTitle} shortSessionId={shortSessionId} /> : null}

      <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
        {pageState === 'welcome' ? (
          <WelcomePage 
            version={getCliVersion()} 
            cwd={process.cwd()} 
            provider={props.controller.getProviderName()}
            logs={welcomeLogs} 
            rows={viewportRows} 
            cols={termSize.cols} 
          >
            <InputArea {...sharedInputProps} />
          </WelcomePage>
        ) : (
          <ChatPage lines={chatLines} />
        )}
      </Box>

      {pageState === 'chat' && <InputArea {...sharedInputProps} />}
      {processing ? <Box paddingX={1}><Text dimColor>处理中...</Text></Box> : null}
    </Box>
  );
}
