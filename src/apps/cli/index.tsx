import React from 'react';
import { render } from 'ink';
import { createPiAgent } from '../../core/pi/factory.js';
import { PiInkApp } from './ink/pi_app.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ quiet: true });

export async function bootstrap() {
  try {
    const agent = await createPiAgent();
    // In this API, we don't have separate session, agent is the stateful entity.

    const { waitUntilExit } = render(
      <PiInkApp agent={agent} onExit={() => process.exit(0)} />
    );

    await waitUntilExit();
  } catch (err) {
    console.error('Bootstrap error:', err);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  bootstrap().catch(err => {
    console.error('Fatal error during bootstrap:', err);
    process.exit(1);
  });
}