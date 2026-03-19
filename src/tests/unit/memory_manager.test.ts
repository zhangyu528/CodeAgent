import { MemoryManager } from '../../core/controller/memory_manager';
import { Message } from '../../core/llm/provider';

export async function test() {
  console.log('=== Running Unit Test: MemoryManager ===');

  /**
   * Test 1: Sliding Window Truncation & Role Alternation
   */
  console.log('\n[Test 1] Truncation & Role Alternation');
  const mm = new MemoryManager(200); // Small limit for testing
  mm.setSystemPrompt({ role: 'system', content: 'You are an assistant.' });

  // Add a sequence of messages
  mm.addMessages([
    { role: 'user', content: 'Hello 1' },
    { role: 'assistant', content: 'Hi 1' },
    { role: 'user', content: 'Hello 2' },
    { role: 'assistant', content: 'Hi 2' },
  ]);

  console.log(`Initial tokens approx: ${mm.getUsage()}`);

  // Add a very large message that forces truncation
  mm.addMessage({ role: 'user', content: 'A'.repeat(500) });

  const history = mm.getMessages();
  console.log(`History length after truncation: ${history.length}`);
  
  // Verify system prompt is still there
  if (!history[0] || history[0].role !== 'system') {
    throw new Error('System prompt lost or misplaced during truncation!');
  }

  // Verify history starts with user (at index 1)
  const firstMsg = history[1];
  if (!firstMsg || firstMsg.role !== 'user') {
    throw new Error(`Invalid history start role: ${firstMsg?.role || 'null'}. Expected 'user'.`);
  }

  console.log('✅ Role alternation and system prompt preserved.');

  /**
   * Test 2: Atomic Tool Groups
   */
  console.log('\n[Test 2] Atomic Units');
  mm.clearHistory();
  mm.addMessages([
    { role: 'user', content: 'Task A' },
    { role: 'assistant', content: 'Thinking...', toolCalls: [{ id: '1', function: { name: 'test', arguments: '{}' } }] },
    { role: 'tool', content: 'Success', toolCallId: '1' },
    { role: 'user', content: 'Task B' }
  ]);

  // Force truncation of 'Task A' block by adding a massive message
  mm.addMessage({ role: 'user', content: 'B'.repeat(2000) });
  
  const h2 = mm.getMessages();
  // It should have shifted out the 'Task A' block completely
  if (h2.some((m: Message) => m.content === 'Task A')) {
    throw new Error(`Truncation failed! 'Task A' still present. History size: ${h2.length}, Tokens: ${mm.getUsage()}`);
  }
  
  console.log('✅ Old blocks removed atomically.');
  console.log('\n=== MemoryManager Unit Test Pass ===');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ MemoryManager Test Failed:', e.message);
    process.exit(1);
  });
}
