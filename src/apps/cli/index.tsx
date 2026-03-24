import React from 'react';
import { render } from 'ink';
import { createPiAgent } from '../../core/pi/factory.js';
import { PiInkApp } from './ink/pi_app.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ quiet: true });

export async function bootstrap() {
  // process.stdout.write('\u001b[?1049h'); // Disable alternate screen buffer for debugging
  try {
    const agent = await createPiAgent();
    console.log('PiAgent created successfully. Ink rendering bypassed for testing.');
    // const { waitUntilExit } = render(
    //   <PiInkApp agent={agent} onExit={() => {}} />
    // );
    // await waitUntilExit();
  } catch (err) {
    // process.stdout.write('\u001b[?1049l'); // Disable alternate screen buffer for debugging
    console.error('Bootstrap error:', err);
    process.exit(1);
  } finally {
    // process.stdout.write('\u001b[?1049l'); // Disable alternate screen buffer for debugging
    process.exit(0);
  }
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});