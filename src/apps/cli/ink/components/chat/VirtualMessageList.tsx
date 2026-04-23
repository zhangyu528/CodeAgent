/**
 * VirtualMessageList — 虚拟滚动列表
 *
 * 架构: marginTop 滚动 + visible-only 渲染
 * - 视窗 Box: height=availableRows, overflow=hidden (裁剪滚动范围外的内容)
 * - 内容 Box: marginTop=-scrollOffset, height=totalHeight (滚动实现)
 * - 内容内部: 只渲染 visibleRange + OVERSCAN 的 items
 *
 * 性能优化:
 * - measureElement 在 idle 时批量执行，不阻塞滚动
 * - heightCache 用 stable identity key (message.id) 而非 flatIndex
 * - scrollOffset state 单一数据源，marginTop 和 visibleRange 同步
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Box, Text, measureElement, useInput } from 'ink';
import { ChatMessage } from '../../pages/types.js';
import { MessageItem } from './MessageItem.js';
import { DateDivider, formatDateLabel } from './DateDivider.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const OVERSCAN = 3;
const ESTIMATED_MSG_HEIGHT = 6; // rows per message (header + content)
const DATE_DIVIDER_HEIGHT = 1;
const MEASURE_DEBOUNCE_MS = 16;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number, width: number = 2): string {
  return n.toString().padStart(width, '0');
}

function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface DateGroup {
  dateLabel: string;
  dateTimestamp: number;
  messages: ChatMessage[];
  startIndex: number;
  endIndex: number;
}

interface RenderItem {
  type: 'header' | 'message';
  groupLabel?: string;
  message?: ChatMessage;
  flatIndex: number;
}

interface VirtualMessageListProps {
  messages: ChatMessage[];
  availableRows: number;
  onLoadMore?: () => void;
  hasMoreAbove?: boolean;
}

export interface VirtualListRef {
  scrollToBottom: () => void;
  scrollToTop: () => void;
  scrollBy: (delta: number) => void;
  scrollTo: (offset: number) => void;
}

// ─── Main component ─────────────────────────────────────────────────────────

export const VirtualMessageList = React.forwardRef<
  VirtualListRef,
  VirtualMessageListProps
>(function VirtualMessageList(
  { messages, availableRows, onLoadMore, hasMoreAbove = false },
  ref
) {
  // ── Scroll state (single source of truth) ──────────────────────────────────
  const [scrollOffset, setScrollOffset] = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const heightCache = useRef<Map<string, number>>(new Map()); // key: message.id
  const isAtBottomRef = useRef(true);
  const isUserScrollingRef = useRef(false);
  const messageIdsRef = useRef<string>(''); // tracks message.id set
  const itemRefs = useRef<Map<string, any>>(new Map()); // key: message.id

  // ── Flatten messages into date groups ─────────────────────────────────────
  const groups = useMemo(() => {
    const groupMap = new Map<string, DateGroup>();
    for (const message of messages) {
      const dateKey = toDateKey(message.createdAt);
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, {
          dateLabel: formatDateLabel(message.createdAt),
          dateTimestamp: message.createdAt,
          messages: [],
          startIndex: 0,
          endIndex: 0,
        });
      }
      groupMap.get(dateKey)!.messages.push(message);
    }
    const sortedGroups = Array.from(groupMap.values()).sort(
      (a, b) => a.dateTimestamp - b.dateTimestamp
    );
    let globalIndex = 0;
    for (const group of sortedGroups) {
      group.startIndex = globalIndex;
      group.endIndex = globalIndex + group.messages.length - 1;
      globalIndex += group.messages.length;
    }
    return sortedGroups;
  }, [messages]);

  // Track message ids for cache invalidation
  const currentMessageIds = useMemo(
    () => messages.map(m => m.id).join(','),
    [messages]
  );

  // ── Compute total height from cache ───────────────────────────────────────
  const computeTotalHeight = useCallback((): number => {
    let h = 0;
    for (const group of groups) {
      h += DATE_DIVIDER_HEIGHT;
      for (const msg of group.messages) {
        h += heightCache.current.get(msg.id) ?? ESTIMATED_MSG_HEIGHT;
      }
    }
    return Math.max(1, h);
  }, [groups]);

  const totalHeight = useMemo(() => computeTotalHeight(), [computeTotalHeight]);

  // ── Find visible range ─────────────────────────────────────────────────────
  const findVisibleRange = useCallback(
    (scrollTop: number, viewportH: number): { start: number; end: number } => {
      if (messages.length === 0) return { start: 0, end: 0 };

      let offset = 0;
      let start = 0;
      let end = messages.length - 1;
      let found = false;

      for (const group of groups) {
        const headerBottom = offset + DATE_DIVIDER_HEIGHT;
        if (!found && headerBottom > scrollTop) {
          start = group.startIndex;
          found = true;
        }
        if (offset < scrollTop + viewportH) {
          end = Math.max(end, group.startIndex);
        }
        offset += DATE_DIVIDER_HEIGHT;

        for (let i = group.startIndex; i <= group.endIndex; i++) {
          const msg = group.messages[i - group.startIndex]!;
          const itemH = heightCache.current.get(msg.id) ?? ESTIMATED_MSG_HEIGHT;
          const itemBottom = offset + itemH;

          if (!found && itemBottom > scrollTop) {
            start = i;
            found = true;
          }
          if (offset < scrollTop + viewportH) {
            end = i;
          }
          offset += itemH;
        }
      }

      const s = Math.max(0, start - OVERSCAN);
      const e = Math.min(messages.length - 1, end + OVERSCAN);
      return { start: s, end: e };
    },
    [groups, messages]
  );

  // visibleRange derives from scrollOffset — single source of truth
  const visibleRange = useMemo(
    () => findVisibleRange(scrollOffset, availableRows),
    [findVisibleRange, scrollOffset, availableRows]
  );

  // ── Scroll API ─────────────────────────────────────────────────────────────
  const scrollTo = useCallback(
    (offset: number) => {
      const maxOffset = Math.max(0, totalHeight - availableRows);
      const clamped = Math.max(0, Math.min(offset, maxOffset));
      setScrollOffset(clamped);
      isAtBottomRef.current = clamped >= maxOffset - 1;

      if (clamped <= 5 && hasMoreAbove && onLoadMore) {
        onLoadMore();
      }
    },
    [totalHeight, availableRows, hasMoreAbove, onLoadMore]
  );

  const scrollBy = useCallback(
    (delta: number) => {
      setScrollOffset(prev => {
        const maxOffset = Math.max(0, totalHeight - availableRows);
        return Math.max(0, Math.min(prev + delta, maxOffset));
      });
    },
    [totalHeight, availableRows]
  );

  const scrollToBottom = useCallback(() => {
    scrollTo(totalHeight);
    isAtBottomRef.current = true;
  }, [scrollTo, totalHeight]);

  const scrollToTop = useCallback(() => {
    scrollTo(0);
  }, [scrollTo]);

  React.useImperativeHandle(ref, () => ({
    scrollToBottom,
    scrollToTop,
    scrollBy,
    scrollTo,
  }), [scrollToBottom, scrollToTop, scrollBy, scrollTo]);

  // ── Keyboard scroll (Ink useInput) ─────────────────────────────────────────
  useInput((_: any, key: any) => {
    if (key.downArrow) {
      isUserScrollingRef.current = true;
      scrollBy(5);
    } else if (key.upArrow) {
      isUserScrollingRef.current = true;
      scrollBy(-5);
    } else if (key.pageDown) {
      isUserScrollingRef.current = true;
      scrollBy(availableRows);
    } else if (key.pageUp) {
      isUserScrollingRef.current = true;
      scrollBy(-availableRows);
    } else if (key.home) {
      isUserScrollingRef.current = true;
      scrollTo(0);
    } else if (key.end) {
      isUserScrollingRef.current = true;
      scrollTo(totalHeight);
    }
  });

  // ── Mouse wheel scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    let buffer = '';
    const handleData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const idx = buffer.indexOf('\x1b[M');
      if (idx >= 0 && idx + 3 <= buffer.length) {
        const char = buffer.charCodeAt(idx + 3);
        if (char === 64) {
          isUserScrollingRef.current = true;
          scrollBy(-3);
        } else if (char === 65) {
          isUserScrollingRef.current = true;
          scrollBy(3);
        }
        buffer = '';
      }
    };
    process.stdin.on('data', handleData);
    return () => { process.stdin.off('data', handleData); };
  }, [scrollBy]);

  // ── Measure visible items (debounced, decoupled from scroll) ───────────────
  useEffect(() => {
    if (visibleRange.start === 0 && visibleRange.end === 0) return;

    const timer = setTimeout(() => {
      let changed = false;
      for (const group of groups) {
        for (let i = group.startIndex; i <= group.endIndex; i++) {
          if (i < visibleRange.start - OVERSCAN || i > visibleRange.end + OVERSCAN) continue;
          const msg = group.messages[i - group.startIndex]!;
          if (heightCache.current.has(msg.id)) continue;
          const el = itemRefs.current.get(msg.id);
          if (!el) continue;
          try {
            const { height } = measureElement(el);
            if (height > 0) {
              heightCache.current.set(msg.id, height);
              changed = true;
            }
          } catch {
            // not ready
          }
        }
      }
      // Note: height changes don't trigger re-render here — they'll affect
      // visibleRange on next scroll event when totalHeight changes
    }, MEASURE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [visibleRange, groups]);

  // ── Invalidate cache when message set changes ─────────────────────────────
  useEffect(() => {
    if (currentMessageIds !== messageIdsRef.current) {
      messageIdsRef.current = currentMessageIds;
      heightCache.current.clear();
      itemRefs.current.clear();
    }
  }, [currentMessageIds]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && isAtBottomRef.current) {
      setTimeout(() => scrollToBottom(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ── Build rendered items ─────────────────────────────────────────────────
  const renderedItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = [];

    for (const group of groups) {
      if (group.endIndex < visibleRange.start - OVERSCAN) continue;
      if (group.startIndex > visibleRange.end + OVERSCAN) break;

      items.push({
        type: 'header',
        groupLabel: group.dateLabel,
        flatIndex: group.startIndex,
      });

      for (let i = group.startIndex; i <= group.endIndex; i++) {
        if (i < visibleRange.start - OVERSCAN) continue;
        if (i > visibleRange.end + OVERSCAN) break;
        const msg = group.messages[i - group.startIndex]!;
        items.push({
          type: 'message',
          message: msg,
          flatIndex: i,
        });
      }
    }

    return items;
  }, [groups, visibleRange]);

  // ── Scroll indicator ─────────────────────────────────────────────────────
  const scrollableRange = Math.max(1, totalHeight - availableRows);
  const rawPercent = Math.round((scrollOffset / scrollableRange) * 100);
  const scrollPercent = Math.min(100, Math.max(0, rawPercent));

  // ── Render ────────────────────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={availableRows}>
      {/* VIEWPORT: clips content outside visible area */}
      <Box flexDirection="column" height={availableRows} overflow="hidden">
        {/* CONTENT: marginTop=-scrollOffset shifts content up.
            Both marginTop and visibleRange derive from same scrollOffset state. */}
        <Box
          flexDirection="column"
          marginTop={-scrollOffset}
          height={totalHeight}
        >
          {renderedItems.map((item) => {
            if (item.type === 'header') {
              return (
                <Box
                  key={`hdr-${item.groupLabel}-${item.flatIndex}`}
                  flexGrow={0}
                  flexShrink={0}
                >
                  <DateDivider label={item.groupLabel!} />
                </Box>
              );
            }

            const msg = item.message!;

            return (
              <Box
                key={msg.id}
                ref={(el: any) => {
                  if (el) itemRefs.current.set(msg.id, el);
                }}
                flexGrow={0}
                flexShrink={0}
              >
                <MessageItem message={msg} />
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Scroll indicator */}
      {totalHeight > availableRows && (
        <Text dimColor>{scrollPercent}%</Text>
      )}
    </Box>
  );
});
