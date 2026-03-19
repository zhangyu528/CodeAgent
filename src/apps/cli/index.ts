import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import React from 'react';
import { render } from 'ink';
import { logger, TelemetryMonitor } from '../../utils/logger';
import { createAgent } from './components/factory';
import { getDefaultSlashCommands } from './components/slash_commands';
import { InkUIAdapter } from './ink/ink_ui_adapter';
import { InkApp } from './ink/app';

// Catch-all for better error reporting
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

dotenv.config({ quiet: true });
const telemetry = new TelemetryMonitor();

export async function bootstrap() {
  try {
    // Check TTY early
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    if (!isTTY) {
      // In some environments (like here), we might not have a full TTY
      // but Ink might still work if we are careful.
      // However, the error message suggests a crash before this.
    }

    const uiAdapter = new InkUIAdapter();
    const { controller, engine } = await createAgent(uiAdapter);
    const commands = getDefaultSlashCommands();

    const { waitUntilExit } = render(
      React.createElement(InkApp, {
        controller,
        engine,
        commands,
        telemetry,
        uiAdapter,
        onExit: () => {
          logger.info('Goodbye!');
          process.exit(0);
        },
      })
    );

    await waitUntilExit();
  } catch (err) {
    console.error('Bootstrap error caught in try/catch:', err);
    throw err;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  console.log('Starting bootstrap...');
  bootstrap().catch(err => {
    console.error('Fatal error during bootstrap catch:', err);
    process.exit(1);
  });
}