/**
 * EscapeChatPage — 全 Escape Sequence 渲染的聊天页
 *
 * 架构：
 * - 所有 UI 输出直接通过 stdout.write()
 * - React 只管理状态和事件分发
 * - 组件 render() => null（无 React 渲染）
 *
 * 生命周期：
 *   mount:   进入 alternate screen → 设置 scroll region → 全量渲染 → 注册 resize
 *   unmount: 清理 alternate screen
 *   resize:  重算 layout → 全量重绘
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Box } from 'ink';
import {
  cursorTo,
  write,
  getTerminalSize,
  enterAlternateScreen,
  exitAlternateScreen,
  setScrollRegion,
  T,
} from '../core/Terminal.js';
import { computeLayout } from '../core/Layout.js';
import { renderHeader } from '../components/EscapeHeader.js';
import { EscapeInput } from '../components/EscapeInput.js';
import { useChatStore } from '../../ink/store/index.js';
import { useAppStore } from '../../ink/store/uiStore.js';
import { useAgentEvents } from '../../ink/hooks/useAgentEvents.js';
import { getAgentSession } from '@codeagent/core';
import { getTerminalSize as getTermSize } from '../core/Terminal.js';
import type { Layout } from '../core/Layout.js';

export function EscapeChatPage() {
  const { rows, cols } = getTermSize();
  const layoutRef = useRef<Layout>(computeLayout(rows, cols));
  const headerRenderedRef = useRef(false);

  const page = useAppStore(s => s.page);
  const pendingPrompt = useChatStore(s => s.pendingPrompt);
  const getAndClearPendingPrompt = useChatStore(s => s.getAndClearPendingPrompt);
  const ensureSessionForPrompt = useChatStore(s => s.ensureSessionForPrompt);
  const persistCurrentSession = useChatStore(s => s.persistCurrentSession);
  const addMessage = useChatStore(s => s.addMessage);
  const updateLastMessage = useChatStore(s => s.updateLastMessage);

  const session = getAgentSession();
  const agent = session?.agent;

  // ── enter alternate screen ────────────────────────────────────────────────
  useEffect(() => {
    write(enterAlternateScreen());
    return () => {
      write(exitAlternateScreen());
    };
  }, []);

  // ── render header ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (headerRenderedRef.current) return;
    headerRenderedRef.current = true;
    const layout = layoutRef.current;
    write(cursorTo(1, 1));
    renderHeader(layout, {});
    write(cursorTo(layout.headerBottom, 1));
  }, []);

  // ── init scroll region ─────────────────────────────────────────────────────
  const initScrollRegion = useCallback(() => {
    const layout = layoutRef.current;
    write(setScrollRegion(layout.scrollTop, layout.scrollBottom));
  }, []);

  // ── resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const { rows: r, cols: c } = getTerminalSize();
      layoutRef.current = computeLayout(r, c);
      headerRenderedRef.current = false;
      renderHeader(layoutRef.current, {});
    };
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, [initScrollRegion]);

  // ── process pending prompt ─────────────────────────────────────────────────
  useEffect(() => {
    if (page !== 'chat') return;
    const pending = pendingPrompt;
    if (!pending) return;

    // 1. 确保 session
    ensureSessionForPrompt(pending);

    // 2. 添加用户消息到 store
    addMessage({
      id: `u-${Date.now()}`,
      role: 'user',
      title: 'You',
      createdAt: Date.now(),
      status: 'completed',
      blocks: [{ kind: 'text', text: pending }],
    });

    // 3. 清除 pending
    getAndClearPendingPrompt();

    // 4. 发送到 agent
    if (agent) {
      void agent.prompt(pending);
    }
  }, [page]);

  // ── agent events ──────────────────────────────────────────────────────────
  useAgentEvents(session, {
    isRawModeSupported: false,
    onRawModeChange: () => {},
    onAgentEnd: () => {
      persistCurrentSession('completed');
    },
    onTurnSettled: status => {
      if (status === 'completed') {
        // nothing extra
      }
    },
    onError: error => {
      console.error('[EscapeChatPage] agent error:', error);
    },
  });

  // ── 路由：未到 chat 阶段就退出 ──────────────────────────────────────────
  if (page !== 'chat') return null;

  return (
    <Box flexDirection="column">
      <Box />
      <EscapeInput isWelcome={false} />
    </Box>
  );
}
