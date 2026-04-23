/**
 * InputCapture — 按键捕获封装
 *
 * 封装 Ink useInput 的按键解析逻辑，提供结构化的 KeyInfo。
 * 组件注册 useInput 回调后，按键事件通过 onKey 分发。
 * 渲染完全由外部通过 stdout.write() 完成，InputCapture 不产生任何 UI。
 */

export interface KeyInfo {
  /** 是否按住 Ctrl */
  ctrl: boolean;
  /** 是否按住 Meta (Alt) */
  meta: boolean;
  /** Shift 按键名 */
  shift: boolean;
  /** 按键名 (upArrow, downArrow, return, escape, backspace, tab, home, end, pageUp, pageDown, f1-f12) */
  name?: string;
  /** 原始字符（无修饰键时） */
  char?: string;
}

type KeyHandler = (ch: string, key: KeyInfo) => void;

/** 解析 Ink useInput 传来的 (input, key) 参数为统一 KeyInfo */
export function parseKey(input: string, key: Record<string, unknown>): KeyInfo {
  return {
    ctrl: Boolean(key.ctrl),
    meta: Boolean(key.meta),
    shift: Boolean(key.shift),
    name: typeof key.name === 'string' ? key.name : undefined,
    char: input && !key.name ? input : undefined,
  };
}

/** 是否为方向键（Arrow 系列） */
export function isArrowKey(key: KeyInfo): boolean {
  return (
    key.name === 'upArrow' ||
    key.name === 'downArrow' ||
    key.name === 'leftArrow' ||
    key.name === 'rightArrow'
  );
}

/** 是否为特殊功能键 */
export function isSpecialKey(key: KeyInfo): boolean {
  return Boolean(key.name);
}

/** 来自 Ink useInput 的 (input, key) 元组类型 */
export type InkKeyTuple = [string, Record<string, unknown>];

let _handler: KeyHandler | null = null;

/**
 * 注册全局按键处理器（供 useInput 回调使用）
 */
export function setInputHandler(handler: KeyHandler): () => void {
  _handler = handler;
  return () => {
    _handler = null;
  };
}

/**
 * 触发按键事件
 */
export function emitKey(input: string, key: Record<string, unknown>): void {
  _handler?.(input, parseKey(input, key));
}

/**
 * InputCapture 组件 — 注册 useInput，按键事件交给 handler
 * 组件本身 render() => null，无任何 UI 输出
 *
 * 注意：需要先调用 setInputHandler 注册处理器，再挂载此组件。
 * 通常在 EscapeApp 顶层调用 setInputHandler，InputCapture 放在 render tree 中。
 */
export function InputCapture(_props: { children?: unknown }): null {
  const { useInput } = require('ink');
  useInput(
    (input: string, key: Record<string, unknown>) => {
      emitKey(input, key);
    },
    { isActive: true }
  );
  return null;
}
