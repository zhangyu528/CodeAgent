/**
 * Terminal — Escape sequence 底层封装
 *
 * 封装常用的 CSI/DEC escape sequences，包括：
 * - 光标控制 (cursor movement)
 * - 屏幕操作 (clear, alternate screen)
 * - DECSTBM scroll region
 * - SGR 颜色/样式
 */

const CSI = '\x1b[';
const ESC = '\x1b';

// ─── 光标控制 ───────────────────────────────────────────────────────────────

/** 移动光标到指定位置 (1-indexed) */
export function cursorTo(row: number, col: number = 1): string {
  return `${CSI}${row};${col}H`;
}

/** 清当前行 */
export function clearLine(): string {
  return `${CSI}2K`;
}

/** 清从光标到行尾 */
export function clearLineToEnd(): string {
  return `${CSI}0K`;
}

/** 清从光标到行首 */
export function clearLineToStart(): string {
  return `${CSI}1K`;
}

/** 清整个屏幕 */
export function clearScreen(): string {
  return `${CSI}2J`;
}

/** 上移 n 行 */
export function cursorUp(n: number = 1): string {
  return `${CSI}${n}A`;
}

/** 下移 n 行 */
export function cursorDown(n: number = 1): string {
  return `${CSI}${n}B`;
}

/** 右移 n 列 */
export function cursorForward(n: number = 1): string {
  return `${CSI}${n}C`;
}

/** 左移 n 列 */
export function cursorBack(n: number = 1): string {
  return `${CSI}${n}D`;
}

// ─── Alternate Screen ─────────────────────────────────────────────────────

/** 进入 alternate screen */
export function enterAlternateScreen(): string {
  return `${CSI}?1049h`;
}

/** 退出 alternate screen */
export function exitAlternateScreen(): string {
  return `${CSI}?1049l`;
}

// ─── DECSTBM Scroll Region ─────────────────────────────────────────────────

/** 设置滚动区域 [top, bottom] (1-indexed, inclusive) */
export function setScrollRegion(top: number, bottom: number): string {
  return `${CSI}${top};${bottom}r`;
}

/** 向上滚动 n 行 */
export function scrollUp(n: number = 1): string {
  return `${CSI}${n}S`;
}

/** 向下滚动 n 行 */
export function scrollDown(n: number = 1): string {
  return `${CSI}${n}T`;
}

/** 重置滚动区域到整屏 */
export function resetScrollRegion(): string {
  return `${CSI}r`;
}

// ─── SGR 样式 ─────────────────────────────────────────────────────────────

/** 重置所有样式 */
export function sgrReset(): string {
  return `${CSI}0m`;
}

/** 加粗 */
export function sgrBold(): string {
  return `${CSI}1m`;
}

/** 弱化/暗淡 */
export function sgrDim(): string {
  return `${CSI}2m`;
}

/** 斜体 */
export function sgrItalic(): string {
  return `${CSI}3m`;
}

/** 下划线 */
export function sgrUnderline(): string {
  return `${CSI}4m`;
}

/** 前景色 (3/4-bit) */
export function sgrFg(color: number): string {
  return `${CSI}${color}m`;
}

/** 背景色 (3/4-bit) */
export function sgrBg(color: number): string {
  return `${CSI}${color}m`;
}

/** 256 色前景 */
export function sgrFg256(r: number, g: number, b: number): string {
  return `${CSI}38;2;${r};${g};${b}m`;
}

/** 256 色背景 */
export function sgrBg256(r: number, g: number, b: number): string {
  return `${CSI}48;2;${r};${g};${b}m`;
}

// ─── 颜色别名 ─────────────────────────────────────────────────────────────

/** 前景色别名 */
export const fg = {
  black: sgrFg(30),
  red: sgrFg(31),
  green: sgrFg(32),
  yellow: sgrFg(33),
  blue: sgrFg(34),
  magenta: sgrFg(35),
  cyan: sgrFg(36),
  white: sgrFg(37),
  gray: sgrFg(90),
  brightRed: sgrFg(91),
  brightGreen: sgrFg(92),
  brightYellow: sgrFg(93),
  brightBlue: sgrFg(94),
  brightMagenta: sgrFg(95),
  brightCyan: sgrFg(96),
  brightWhite: sgrFg(97),
};

/** 背景色别名 */
export const bg = {
  black: sgrBg(40),
  red: sgrBg(41),
  green: sgrBg(42),
  yellow: sgrBg(43),
  blue: sgrBg(44),
  magenta: sgrBg(45),
  cyan: sgrBg(46),
  white: sgrBg(47),
  brightBlack: sgrBg(100),
  brightRed: sgrBg(101),
  brightGreen: sgrBg(102),
  brightYellow: sgrBg(103),
  brightBlue: sgrBg(104),
  brightMagenta: sgrBg(105),
  brightCyan: sgrBg(106),
  brightWhite: sgrBg(107),
};

// ─── 组合 helper ───────────────────────────────────────────────────────────

/** 常用样式组合 */
export const style = {
  reset: sgrReset(),
  bold: sgrBold(),
  dim: sgrDim(),
  underline: sgrUnderline(),
  cyanBold: sgrBold() + fg.cyan,
  blueBold: sgrBold() + fg.blue,
  redBold: sgrBold() + fg.red,
  yellowBold: sgrBold() + fg.yellow,
  whiteBold: sgrBold() + fg.white,
  grayDim: sgrDim() + fg.gray,
  selected: sgrBold() + fg.white + bg.brightBlue,
  inputCursor: sgrBold() + fg.cyan,
  border: fg.gray,
  divider: fg.gray + sgrDim(),
};

// ─── T: 命名空间导出（兼容风格）────────────────────────────────────────────

/** T 是所有终端操作的命名空间别名 */
export const T = {
  cursorTo,
  clearLine,
  clearLineToEnd,
  clearScreen,
  cursorUp,
  cursorDown,
  cursorForward,
  cursorBack,
  enterAlternateScreen,
  exitAlternateScreen,
  setScrollRegion,
  scrollUp,
  scrollDown,
  resetScrollRegion,
  sgrReset,
  sgrBold,
  sgrDim,
  sgrItalic,
  sgrUnderline,
  sgrFg,
  sgrBg,
  sgrFg256,
  sgrBg256,
  fg,
  bg,
  style,
  getTerminalSize,
};

// ─── 写终端 ───────────────────────────────────────────────────────────────

/** 向终端写入（同步） */
export function write(...parts: string[]): void {
  process.stdout.write(parts.join(''));
}

/** 向终端写入一行 */
export function writeLine(line: string): void {
  process.stdout.write(line + '\r\n');
}

/** 清屏并移动光标到 (1,1) */
export function clearAndHome(): void {
  process.stdout.write(clearScreen() + cursorTo(1, 1));
}

// ─── 终端尺寸 ─────────────────────────────────────────────────────────────

export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}

// ─── 保存/恢复光标 ─────────────────────────────────────────────────────────

/** 保存光标位置和样式 */
export function saveCursor(): string {
  return `${ESC}7`;
}

/** 恢复光标位置和样式 */
export function restoreCursor(): string {
  return `${ESC}8`;
}
