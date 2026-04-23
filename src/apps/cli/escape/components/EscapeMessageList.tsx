/**
 * EscapeMessageList — 消息列表（Escape Sequence 渲染）
 *
 * 架构：
 * - 组件接收 messages 作为 prop（外部通过 useChatStore 订阅并传入）
 * - 内部维护 renderedLines[] 缓冲，renderedLines 完整保存所有已渲染行
 * - 收到新 messages 时，对比 prev，增量追加到 renderedLines 和终端
 * - resize 时全量重绘
 * - expose imperativeHandle: fullRender(), clear(), appendMessage()
 */

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { T, cursorTo, clearLine, write, getTerminalSize } from '../core/Terminal.js';
import { computeLayout, wrapText } from '../core/Layout.js';
import type { ChatMessage, ChatMessageBlock } from '../../ink/pages/types.js';

// ─── 格式化 ───────────────────────────────────────────────────────────────

const CC = {
  reset: T.sgrReset(),
  bold: T.sgrBold(),
  dim: T.sgrDim(),
  cyan: T.fg.cyan,
  blue: T.fg.blue,
  white: T.fg.white,
  gray: T.fg.gray,
  red: T.fg.red,
  yellow: T.fg.yellow,
};

function roleLabel(role: string): string {
  switch (role) {
    case 'user':
      return 'You';
    case 'assistant':
      return 'Assistant';
    case 'error':
      return 'Error';
    default:
      return role;
  }
}

function formatBlock(block: ChatMessageBlock, maxWidth: number): string[] {
  if (block.kind === 'thinking') {
    const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
    if (collapsed) return [`${CC.gray}▸ [Thinking]${CC.reset}`];
    const lines = wrapText(block.text, maxWidth);
    return [`${CC.gray}▾ [Thinking]${CC.reset}`, ...lines.map(l => `${CC.gray}${l}${CC.reset}`)];
  }

  if (block.kind === 'reasoning') {
    const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
    if (collapsed) return [`${CC.gray}▸ [Reasoning]${CC.reset}`];
    const lines = wrapText(block.text, maxWidth);
    return [`${CC.gray}▾ [Reasoning]${CC.reset}`, ...lines.map(l => `${CC.gray}${l}${CC.reset}`)];
  }

  if (block.kind === 'toolSummary') {
    const collapsed = (block as { collapsed?: boolean }).collapsed !== false;
    if (collapsed) return [`${CC.gray}▸ [Tools]${CC.reset}`];
    const lines = block.text.split('\n').filter(l => l.trim());
    const formatted = lines.map((line, i) => {
      const prefix = i === lines.length - 1 ? '└── ' : '├── ';
      return `${CC.gray}${prefix}${line}${CC.reset}`;
    });
    return [`${CC.gray}▾ [Tools]${CC.reset}`, ...formatted];
  }

  return wrapText(block.text, maxWidth);
}

function formatMessage(msg: ChatMessage, maxWidth: number): string[] {
  const lines: string[] = [];
  const borderColor =
    msg.role === 'user'
      ? CC.cyan
      : msg.role === 'assistant'
        ? CC.blue
        : msg.role === 'error'
          ? CC.red
          : CC.yellow;

  lines.push(`${CC.dim}│${CC.reset} ${borderColor}${CC.bold}${roleLabel(msg.role)}${CC.reset}`);

  for (const block of msg.blocks) {
    for (const line of formatBlock(block, maxWidth)) {
      lines.push(`${CC.dim}│${CC.reset} ${line}`);
    }
  }

  return lines;
}

// ─── 渲染器 ─────────────────────────────────────────────────────────────

export interface EscapeMessageListHandle {
  fullRender(): void;
  clear(): void;
}

export interface EscapeMessageListProps {
  messages: ChatMessage[];
  /** 触发全量重绘的信号（resize、切换会话等） */
  version?: number;
}

export const EscapeMessageList = forwardRef<EscapeMessageListHandle, EscapeMessageListProps>(
  function EscapeMessageList({ messages, version }, ref) {
    // Layout ref（组件不 re-render，只在 resize 时更新）
    const layoutRef = useRef(computeLayout(getTerminalSize().rows, getTerminalSize().cols));

    // 渲染缓冲
    const renderedLinesRef = useRef<string[]>([]);

    // 上一次渲染的 messages JSON（用于 diff）
    const prevJsonRef = useRef('[]');

    // ── 全量重绘 ───────────────────────────────────────────────────────────
    const fullRender = React.useCallback(() => {
      const layout = layoutRef.current;
      const { scrollTop, scrollBottom } = layout;

      // 清空 scroll region
      for (let r = scrollTop; r <= scrollBottom; r++) {
        process.stdout.write(cursorTo(r, 1) + clearLine());
      }

      const maxVisible = layout.scrollRows;
      const visible = renderedLinesRef.current.slice(-maxVisible);
      const startRow = scrollBottom - visible.length + 1;

      for (let i = 0; i < visible.length; i++) {
        process.stdout.write(cursorTo(startRow + i, 1) + clearLine() + visible[i]);
      }

      process.stdout.write(cursorTo(layout.inputTop, 1));
    }, []);

    // ── 追加单条消息到终端 ─────────────────────────────────────────────────
    const appendMessageToTerminal = React.useCallback((msg: ChatMessage) => {
      const layout = layoutRef.current;
      const maxWidth = layout.cols - 2;
      const lines = formatMessage(msg, maxWidth);
      const { scrollBottom } = layout;

      for (const line of lines) {
        process.stdout.write(cursorTo(scrollBottom, 1));
        process.stdout.write(clearLine());
        process.stdout.write(line);
        process.stdout.write(T.scrollUp(1));
      }

      process.stdout.write(cursorTo(layout.inputTop, 1));
    }, []);

    // ── 更新最后一条消息（流式场景）─────────────────────────────────────────
    const updateLastMessageOnTerminal = React.useCallback(
      (msg: ChatMessage) => {
        // 找到最后一条消息在 renderedLines 中的起始位置
        const lines = renderedLinesRef.current;
        let start = lines.length - 1;
        while (start > 0 && (lines[start - 1]?.includes('│') ?? false)) {
          start--;
        }
        const maxWidth = layoutRef.current.cols - 2;
        const newLines = formatMessage(msg, maxWidth);

        // 替换 buffer
        lines.splice(start, lines.length - start, ...newLines);

        // 全量重绘（简化）
        fullRender();
      },
      [fullRender]
    );

    // ── 初始化：全量渲染历史消息 ───────────────────────────────────────────
    useEffect(() => {
      const { rows, cols } = getTerminalSize();
      layoutRef.current = computeLayout(rows, cols);

      renderedLinesRef.current = [];
      prevJsonRef.current = '[]';

      // 全量渲染
      for (const msg of messages) {
        const maxWidth = layoutRef.current.cols - 2;
        renderedLinesRef.current.push(...formatMessage(msg, maxWidth));
      }
      fullRender();
      prevJsonRef.current = JSON.stringify(messages);
    }, []);

    // ── version 变化时全量重绘（resize、切换会话）───────────────────────────
    useEffect(() => {
      fullRender();
    }, [version, fullRender]);

    // ── messages prop 变化时增量追加 ───────────────────────────────────────
    useEffect(() => {
      const json = JSON.stringify(messages);
      if (json === prevJsonRef.current) return;
      prevJsonRef.current = json;

      const prevJson = prevJsonRef.current;
      let prevMessages: ChatMessage[] = [];
      let currMessages: ChatMessage[] = [];

      try {
        prevMessages = JSON.parse(prevJson === '[]' ? '[]' : prevJson);
      } catch {
        /* ignore */
      }
      currMessages = messages;

      if (currMessages.length > prevMessages.length) {
        // 增量追加
        for (let i = prevMessages.length; i < currMessages.length; i++) {
          renderedLinesRef.current.push(
            ...formatMessage(currMessages[i]!, layoutRef.current.cols - 2)
          );
          appendMessageToTerminal(currMessages[i]!);
        }
      } else if (currMessages.length !== prevMessages.length) {
        // 数量变化（减少或重置）：全量重绘
        renderedLinesRef.current = [];
        for (const msg of currMessages) {
          renderedLinesRef.current.push(...formatMessage(msg, layoutRef.current.cols - 2));
        }
        fullRender();
      }
      // 数量不变但内容变化（streaming 更新）：不做处理，等待 streaming handler
    }, [messages, appendMessageToTerminal, fullRender]);

    useImperativeHandle(ref, () => ({
      fullRender,
      clear: () => {
        renderedLinesRef.current = [];
        const { scrollTop, scrollBottom } = layoutRef.current;
        for (let r = scrollTop; r <= scrollBottom; r++) {
          process.stdout.write(cursorTo(r, 1) + clearLine());
        }
      },
    }));

    // 此组件不渲染任何 React 元素，所有输出通过 stdout.write()
    return null;
  }
);
