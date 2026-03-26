import React from 'react';
import { render } from 'ink';
import { createPiAgent } from '../../core/pi/factory.js';
import { PiInkApp } from './ink/pi_app.js';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function bootstrap() {
  // Use alternate screen buffer
  process.stdout.write('\u001b[?1049h');
  // Hide the terminal cursor while Ink is running
  process.stdout.write('\u001b[?25l');

  try {
    const agent = await createPiAgent();
    const { waitUntilExit } = render(
      <PiInkApp agent={agent} onExit={() => {}} />,
      { exitOnCtrlC: false }
    );
    
    await waitUntilExit();
  } catch (err: any) {
    // Return to main buffer before showing error
    process.stdout.write('\u001b[?25h');
    process.stdout.write('\u001b[?1049l');
    console.error('Bootstrap error:', err);
    if (err?.stack) {
        console.error(err.stack);
    }
    process.exit(1);
  } finally {
    // Clear screen and Return to main buffer
    process.stdout.write('\u001b[2J\u001b[H'); // Clear and Reset cursor
    process.stdout.write('\u001b[?25h');
    process.stdout.write('\u001b[?1049l');
    process.exit(0);
  }
}

bootstrap().catch(err => {
  process.stdout.write('\u001b[?25h');
  process.stdout.write('\u001b[?1049l');
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
