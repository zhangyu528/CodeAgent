import { attachKeybindings } from '../../cli/keybindings';
import { EventEmitter } from 'events';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

function mockFn() {
  const f = (...args: any[]) => { (f as any).calls.push(args); };
  (f as any).calls = [];
  return f;
}

export async function test() {
  console.log('=== Running Unit Test: Keybindings (Slash Detection) ===');

  const mockStdin = new EventEmitter() as any;
  mockStdin.isTTY = true;

  const mockRl = {
    line: '',
    on: mockFn(),
    write: mockFn(),
  } as any;

  let slashTriggered = false;
  const opts = {
    rl: mockRl,
    isTTY: true,
    getMode: () => 'IDLE' as any,
    isInputSuspended: () => false,
    isCapturing: () => false,
    cancelCapture: mockFn(),
    abortCurrent: mockFn(),
    onClearScreen: mockFn(),
    onExit: mockFn(),
    onHint: mockFn(),
    onSlash: () => { slashTriggered = true; },
  };

  const { detach } = attachKeybindings({ ...opts, stdin: mockStdin } as any);

  // Simulate '/' keypress on empty line
  mockStdin.emit('keypress', '/', { name: '/' });
  assert(slashTriggered, 'onSlash should be triggered when line is empty');

  // Reset and simulate '/' keypress on non-empty line
  slashTriggered = false;
  mockRl.line = 'some input';
  mockStdin.emit('keypress', '/', { name: '/' });
  assert(!slashTriggered, 'onSlash should NOT be triggered when line is NOT empty');

  detach();
  console.log('✅ Keybindings slash detection verified.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ Keybindings test failed:', e.message);
    process.exit(1);
  });
}
