import { ToolBubbles } from '../../apps/cli/components/tool_bubbles';

export async function test() {
  console.log('=== Running Unit Test: Tool Bubbles ===');

  const tb = new ToolBubbles({ maxItems: 2, enabled: false });

  tb.onToolStarted('read_file', { filePath: 'a.txt' });
  tb.onToolFinished('read_file', 'ok');

  tb.onToolStarted('write_file', { filePath: 'b.txt' });
  tb.onToolFinished('write_file', 'Error: denied');

  tb.onToolStarted('run_command', { command: 'dir' });

  const items = tb.list();
  if (items.length !== 2) throw new Error('maxItems trimming failed');
  if (items[0]!.toolName !== 'write_file') throw new Error('expected write_file to be first after trim');
  if (items[0]!.status !== 'err') throw new Error('expected write_file status err');
  if (items[1]!.toolName !== 'run_command') throw new Error('expected run_command to be last');
  if (items[1]!.status !== 'running') throw new Error('expected run_command status running');

  console.log('✅ Tool bubbles works.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ Tool bubbles test failed:', e.message);
    process.exit(1);
  });
}
