/**
 * EscapeHeader — 聊天页头部
 *
 * 固定两行：
 *   Row 1: 会话标题 + 模型信息
 *   Row 2: 分隔线
 */

import { T, cursorTo, clearLine, write } from '../core/Terminal.js';
import { separator } from '../core/Layout.js';
import type { Layout } from '../core/Layout.js';

export interface HeaderInfo {
  sessionName?: string;
  modelLabel?: string;
  status?: 'active' | 'completed' | 'error' | null;
  tokenUsage?: { input: number; output: number; cost: number } | null;
}

/** 渲染头部到终端 */
export function renderHeader(layout: Layout, info: HeaderInfo): void {
  const { cols, headerTop, inputTop } = layout;
  const line1 = headerTop;
  const line2 = headerTop + 1;

  // Row 1: 会话信息
  write(cursorTo(line1, 1), clearLine());

  const title = info.sessionName || 'CodeAgent';
  const model = info.modelLabel ? ` · ${info.modelLabel}` : '';
  const status = info.status === 'active' ? ' ◉' : info.status === 'error' ? ' ✗' : '';

  write(`${T.sgrBold()}${T.fg.blue}${title}${T.sgrReset()}${model}${status || ''}`);

  // Row 2: 分隔线
  write(cursorTo(line2, 1), clearLine());
  write(separator(cols, T.fg.blue));

  // 光标移到 input 区
  write(cursorTo(inputTop, 1));
}
