/**
 * JSON Mode CLI entry point
 * Non-interactive NDJSON output for programmatic use
 */

import { ensureAgentInitialized } from '@codeagent/backend';
import { initJsonMode, handleAgentEvent } from './JsonMode.js';
import { emit } from './emitter.js';

export interface JsonCliFlags {
  prompt?: string;
  session?: string;
}

export async function runJsonCli(flags: JsonCliFlags): Promise<void> {
  // Ensure stdout is writable
  process.stdout.write('');

  // Initialize agent session
  const session = await ensureAgentInitialized();

  // Initialize JSON mode
  initJsonMode();

  // Subscribe to session events and emit NDJSON
  const unsubscribe = session.subscribe((event) => {
    handleAgentEvent(event);
  });

  // If a session ID is provided, restore it
  if (flags.session) {
    const { useChatStore } = await import('../ink/store/chatStore.js');
    await useChatStore.getState().restoreSessionById(flags.session);
  }

  // Send prompt
  if (flags.prompt) {
    const { useChatStore } = await import('../ink/store/chatStore.js');
    await useChatStore.getState().ensureSessionForPrompt(flags.prompt);
    try {
      await session.prompt(flags.prompt);
    } catch (err) {
      emit({
        type: 'error',
        code: 'PROMPT_FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  unsubscribe();
}
