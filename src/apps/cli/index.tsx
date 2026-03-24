import React from 'react';
import { render } from 'ink';
import { createPiAgent } from '../../core/pi/factory.js';
import { PiInkApp } from './ink/pi_app.js';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function bootstrap() {
  // Use alternate screen buffer
  process.stdout.write('\u001b[?1049h');

  try {
    const agent = await createPiAgent();
    const { waitUntilExit } = render(
      <PiInkApp agent={agent} onExit={() => {}} />,
      { exitOnCtrlC: false }
    );
    
    await waitUntilExit();
  } catch (err: any) {
    console.error('Bootstrap error:', err);
    if (err?.stack) {
        console.error(err.stack);
    }
    process.exit(1);
  } finally {
    process.stdout.write('\u001b[?1049l');
    process.exit(0);
  }
}

bootstrap().catch(err => {
  process.stdout.write('\u001b[?1049l');
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
