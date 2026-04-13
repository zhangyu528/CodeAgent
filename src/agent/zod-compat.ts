/**
 * Zod Version Compatibility Layer
 * 
 * Detects Zod version at runtime, works with both Zod 3.x and 4.x.
 * Zod 4 removed the `.version` property from the main export.
 * Source: https://zod.dev/CHANGELOG (Zod 4 breaking changes)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Returns the Zod version string, or 'unknown' if undetectable.
 * Works with Zod 3.x (which exports `z.version`) and Zod 4.x (which does not).
 */
export function getZodVersion(): string {
  try {
    // Zod 4: version is in package.json, not on the main export
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkg = JSON.parse(readFileSync(resolve(require.resolve('zod'), '..', 'package.json'), 'utf-8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    // Fallback for Zod 3 which has z.version on the export
    try {
      // Dynamic import to avoid hard coupling
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { z } = require('zod') as { z: { version?: string } };
      return z.version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

export function isZod4(): boolean {
  return getZodVersion().startsWith('4.');
}
