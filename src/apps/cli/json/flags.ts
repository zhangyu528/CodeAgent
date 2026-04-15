/**
 * CLI Flag Parsing for JSON output mode
 * Minimal flag parser for --json, --prompt, --session flags
 */

export interface CliFlags {
  json: boolean;
  prompt?: string;
  session?: string;
}

/**
 * Parse CLI flags from argv array
 * Supports: --json, --prompt <value>, --session <value>
 * Unknown flags are silently ignored
 */
export function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { json: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--prompt') {
      if (argv[i + 1]) {
        flags.prompt = argv[++i];
      }
    } else if (arg === '--session') {
      if (argv[i + 1]) {
        flags.session = argv[++i];
      }
    }
    // Unknown flags are silently ignored
  }

  return flags;
}
