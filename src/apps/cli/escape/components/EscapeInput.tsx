/**
 * EscapeInput — 输入区（Escape Sequence 渲染 + 状态管理）
 *
 * 负责：
 * 1. 按键捕获（Ink useInput）
 * 2. 输入状态：value、cursorPos、command mode
 * 3. 渲染：prompt + value + cursor，刷新终端
 * 4. 回调：onSubmit(chars)、onSlash(prefix)
 *
 * 所有渲染直接写 stdout，不走 React state → re-render 流程。
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useInput } from 'ink';
import { T, cursorTo, clearLine, write, getTerminalSize } from '../core/Terminal.js';
import { computeLayout } from '../core/Layout.js';
import { useChatStore } from '../../ink/store/index.js';
import { useAppStore } from '../../ink/store/uiStore.js';
import { getAgentSession } from '@codeagent/core';

const ESC = '\x1b';
const PROMPT = ' CHAT ';
const COMMAND_PROMPT = ' COMMAND ';

// ─── 渲染 ───────────────────────────────────────────────────────────────

function renderInputLine(
  value: string,
  cursorPos: number,
  isCommandMode: boolean,
  cols: number,
  cursorRow: number
): void {
  const prompt = isCommandMode ? COMMAND_PROMPT : PROMPT;
  const promptColor = isCommandMode ? T.sgrBold() + T.fg.white : T.sgrBold() + T.fg.cyan;
  const cursorChar = '▌';
  const dimColor = T.sgrDim();
  const reset = T.sgrReset();

  // 第一行：prompt + value + cursor
  write(cursorTo(cursorRow, 1));
  write(clearLine());
  write(promptColor + prompt + reset + dimColor + ' ' + reset);
  write(value);

  // 光标位置
  const cursorCol = prompt.length + 2 + cursorPos + 1;
  write(cursorTo(cursorRow, cursorCol));
  write(T.sgrBold() + T.fg.cyan + cursorChar + reset);

  // 第二行：占位提示（当 value 为空时）
  if (!value) {
    const placeholder = isCommandMode ? '' : 'Type a message...';
    if (placeholder) {
      write(cursorTo(cursorRow + 1, 1));
      write(clearLine());
      write(promptColor + prompt + reset + dimColor + ' ' + reset);
      write(T.sgrDim() + placeholder + reset);
      // 还原光标
      write(cursorTo(cursorRow, prompt.length + 3));
    }
  }
}

function renderInputFooter(
  isWelcome: boolean,
  modelLabel: string | null,
  cwdLabel: string,
  cursorRow: number,
  rows: number,
  cols: number
): void {
  // footer 在 input 区底部
  const footerRow = rows; // 最后一行
  write(cursorTo(footerRow, 1));
  write(clearLine());

  const reset = T.sgrReset();
  const dim = T.sgrDim();

  // 左侧：model + context
  let left = '';
  if (modelLabel) left += `${dim}[${reset}${modelLabel}${dim}]${reset}`;
  if (!isWelcome) left += `  ${dim}Ctrl+C=exit${reset}`;

  // 右侧：cwd
  const right = `${dim}${cwdLabel}${reset}`;

  if (left) write(left);
  if (right) {
    const padding = Math.max(1, cols - left.length - right.length);
    write(' '.repeat(padding));
    write(right);
  }
}

// ─── 组件 ────────────────────────────────────────────────────────────────

export interface EscapeInputHandle {
  getValue: () => string;
  setValue: (v: string) => void;
  clear: () => void;
}

export interface EscapeInputProps {
  isWelcome?: boolean;
}

export const EscapeInput = forwardRef<EscapeInputHandle, EscapeInputProps>(function EscapeInput(
  { isWelcome = false },
  ref
) {
  const [value, setValueRaw] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0); // 触发重新渲染

  const layoutRef = useRef(computeLayout(getTerminalSize().rows, getTerminalSize().cols));

  const currentModel = useAppStore(state => state.currentModel);
  const setPage = useAppStore(state => state.setPage);
  const ensureSessionForPrompt = useChatStore(state => state.ensureSessionForPrompt);
  const setPendingPrompt = useChatStore(state => state.setPendingPrompt);
  const addMessage = useChatStore(state => state.addMessage);

  const session = getAgentSession();

  // ── render ──────────────────────────────────────────────────────────────
  const doRender = useCallback(() => {
    const { rows, cols } = getTerminalSize();
    layoutRef.current = computeLayout(rows, cols);
    const inputRow = layoutRef.current.inputTop;
    const isCommandMode = value.startsWith('/') && !value.includes(' ');
    renderInputLine(value, cursorPos, isCommandMode, cols, inputRow);
    renderInputFooter(isWelcome, currentModel, shortenCwd(process.cwd()), inputRow, rows, cols);
  }, [value, cursorPos, isWelcome, currentModel]);

  // ── submit ──────────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!currentModel) {
      // TODO: 触发 config
      return;
    }

    if (isWelcome) {
      ensureSessionForPrompt(trimmed);
      setPendingPrompt(trimmed);
      setPage('chat');
    } else {
      ensureSessionForPrompt(trimmed);
      addMessage({
        id: `u-${Date.now()}`,
        role: 'user',
        title: 'You',
        createdAt: Date.now(),
        status: 'completed',
        blocks: [{ kind: 'text', text: trimmed }],
      });
      void session.prompt(trimmed);
    }

    setValueRaw('');
    setCursorPos(0);
  }, [
    value,
    currentModel,
    isWelcome,
    ensureSessionForPrompt,
    setPendingPrompt,
    setPage,
    addMessage,
    session,
  ]);

  // ── setValue ────────────────────────────────────────────────────────────
  const setValue = useCallback((v: string | ((prev: string) => string)) => {
    setValueRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      setCursorPos(next.length);
      return next;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => value,
      setValue,
      clear: () => {
        setValueRaw('');
        setCursorPos(0);
      },
    }),
    [value, setValue]
  );

  // ── resize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const { rows, cols } = getTerminalSize();
      layoutRef.current = computeLayout(rows, cols);
      doRender();
    };
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, [doRender]);

  // ── 每次 value/cursorPos 变化时重新渲染 ────────────────────────────────
  useEffect(() => {
    doRender();
  }, [doRender]);

  // ── 按键捕获 ────────────────────────────────────────────────────────────
  useInput((input, key) => {
    // Return: submit
    if (key.return || input === '\r') {
      const hasSlash = value.startsWith('/') && !value.includes(' ');
      if (hasSlash) return; // slash command 由 SlashList 处理
      submit();
      return;
    }

    // Character input
    if (input) {
      if (key.ctrl || key.meta) return;
      setValue(prev => prev + input);
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
      return;
    }

    // Escape: clear
    if (key.escape) {
      setValueRaw('');
      setCursorPos(0);
      return;
    }

    // Arrow keys: cursor movement (future)
    if (key.leftArrow) {
      setCursorPos(p => Math.max(0, p - 1));
      return;
    }
    if (key.rightArrow) {
      setCursorPos(p => Math.min(value.length, p + 1));
      return;
    }

    // Home/End
    if (key.home) {
      setCursorPos(0);
      return;
    }
    if (key.end) {
      setCursorPos(value.length);
      return;
    }
  });

  // 此组件不渲染 React 元素，所有输出通过 stdout.write()
  return null;
});

function shortenCwd(cwd: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home && cwd.startsWith(home)) return '~' + cwd.slice(home.length);
  return cwd;
}
