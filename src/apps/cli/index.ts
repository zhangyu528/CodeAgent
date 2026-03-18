import * as dotenv from 'dotenv';
import { logger, TelemetryMonitor } from '../../utils/logger';
import { createAgent } from './components/factory';
import { getDefaultSlashCommands } from './components/slash_commands';
import { InputManager } from './components/input_manager';

dotenv.config({ quiet: true });
const telemetry = new TelemetryMonitor();

export async function bootstrap() {
  try {
    const isDumb = process.env.TERM === 'dumb';
    const forceBlessed = process.env.FORCE_BLESSED === '1' || process.env.FORCE_BLESSED === 'true';
    const blessedSupported = !isDumb || forceBlessed;

    if (!blessedSupported) {
      console.error('Blessed is not supported in this terminal.');
      console.error('Requirement: TERM must not be "dumb" (or set FORCE_BLESSED=1).');
      console.error(`Current TERM: ${process.env.TERM || 'not set'}`);
      process.exit(1);
    }

    const inputManager = new InputManager({
      provider: 'initializing',
      providers: [],
      onExit: () => {
        logger.info('Goodbye!');
        process.exit(0);
      },
    });

    const uiAdapter = inputManager.getBlessedUIAdapter();
    const { controller, engine } = await createAgent(uiAdapter);
    const commands = getDefaultSlashCommands();

    inputManager.setProviderInfo(controller.getProviderName(), engine.listProviders());
    inputManager.attachRuntime({
      controller,
      engine,
      commands,
      telemetry,
    });

    inputManager.start();
    process.stdin.resume();
  } catch (err) {
    console.error('Bootstrap error:', err);
    throw err;
  }
}

if (require.main === module) {
  bootstrap().catch(err => {
    logger.error('Fatal error during bootstrap: ' + (err?.message || String(err)));
    process.exit(1);
  });
}
