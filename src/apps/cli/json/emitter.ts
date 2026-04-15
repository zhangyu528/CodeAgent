/**
 * NDJSON Emitter for JSON output mode
 * Writes JSON events to stdout as newline-delimited JSON
 */

import type { JsonEvent } from './types.js';

let isEnabled = false;

export function setJsonMode(enabled: boolean): void {
  isEnabled = enabled;
}

export function resetEmitter(): void {
  isEnabled = false;
}

/**
 * Emit a JSON event as a NDJSON line to stdout
 * Only emits when JSON mode is enabled
 */
export function emit(event: JsonEvent): void {
  if (!isEnabled) return;
  process.stdout.write(JSON.stringify(event) + '\n');
}
