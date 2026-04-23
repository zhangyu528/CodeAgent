/**
 * Terminal — Escape sequence 底层封装
 */
const ESC = '\x1b';
const CSI = `${ESC}[`;

export function cursorTo(row: number, col: number = 1): string {
  return `${CSI}${row};${col}H`;
}
export function clearLine(): string {
  return `${CSI}2K`;
}
export function clearLineToEnd(): string {
  return `${CSI}0K`;
}
export function clearLineToStart(): string {
  return `${CSI}1K`;
}
export function clearScreen(): string {
  return `${CSI}2J${cursorTo(1, 1)}`;
}
export function cursorUp(n = 1): string { return `${CSI}${n}A`; }
export function cursorDown(n = 1): string { return `${CSI}${n}B`; }
export function cursorForward(n = 1): string { return `${CSI}${n}C`; }
export function cursorBack(n = 1): string { return `${CSI}${n}D`; }
export function enterAlternateScreen(): string {
  return `${CSI}?1049h`;
}
export function exitAlternateScreen(): string {
  return `${CSI}?1049l`;
}
export function setScrollRegion(top: number, bottom: number): string {
  return `${CSI}${top};${bottom}r`;
}
export function resetScrollRegion(): string {
  return `${CSI}r`;
}
export function scrollUp(n = 1): string { return `${CSI}${n}S`; }
export function scrollDown(n = 1): string { return `${CSI}${n}T`; }
export function saveCursor(): string { return `${ESC}7`; }
export function restoreCursor(): string { return `${ESC}8`; }
export function hideCursor(): string { return `${CSI}?25l`; }
export function showCursor(): string { return `${CSI}?25h`; }

export function sgrReset(): string { return `${CSI}0m`; }
export function sgrBold(): string { return `${CSI}1m`; }
export function sgrDim(): string { return `${CSI}2m`; }
export function sgrItalic(): string { return `${CSI}3m`; }
export function sgrUnderline(): string { return `${CSI}4m`; }
export function sgrFg(color: number): string { return `${CSI}38;5;${color}m`; }
export function sgrBg(color: number): string { return `${CSI}48;5;${color}m`; }
export function sgrFgHex(r: number, g: number, b: number): string {
  return `${CSI}38;2;${r};${g};${b}m`;
}
export function sgrBgHex(r: number, g: number, b: number): string {
  return `${CSI}48;2;${r};${g};${b}m`;
}

export const fg = {
  black: sgrFg(0),
  red: sgrFg(1),
  green: sgrFg(2),
  yellow: sgrFg(3),
  blue: sgrFg(4),
  magenta: sgrFg(5),
  cyan: sgrFg(6),
  white: sgrFg(7),
  gray: sgrFg(8),
  brightBlack: sgrFg(8),
  brightRed: sgrFg(9),
  brightGreen: sgrFg(10),
  brightYellow: sgrFg(11),
  brightBlue: sgrFg(12),
  brightMagenta: sgrFg(13),
  brightCyan: sgrFg(14),
  brightWhite: sgrFg(15),
};

export const bg = {
  black: sgrBg(0),
  red: sgrBg(1),
  green: sgrBg(2),
  yellow: sgrBg(3),
  blue: sgrBg(4),
  magenta: sgrBg(5),
  cyan: sgrBg(6),
  white: sgrBg(7),
};

export const T = {
  reset: sgrReset,
  bold: sgrBold,
  dim: sgrDim,
  italic: sgrItalic,
  underline: sgrUnderline,
  fg,
  bg,
};

export function write(...parts: string[]): void {
  process.stdout.write(parts.join(''));
}

export function writeLine(line: string): void {
  write(line, '\n');
}

export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}
