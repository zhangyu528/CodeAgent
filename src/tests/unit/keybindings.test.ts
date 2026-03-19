import { attachKeybindings } from '../../apps/cli/components/keybindings';
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
  console.log('=== Running Unit Test: Keybindings (Optimized Behaviors) ===');

  const mockStdin = new EventEmitter() as any;
  mockStdin.isTTY = true;

  const mockRl = {
    line: '',
    cursor: 0,
    on: mockFn(),
    write: mockFn(),
  } as any;

  let slashTriggered = false;
  let exitTriggered = false;
  let hudToggled = false;
  let cancelTriggered = false;

  const opts = {
    rl: mockRl,
    isTTY: true,
    getMode: () => 'IDLE' as any,
    isInputSuspended: () => false,
    isCapturing: () => false,
    cancelCapture: () => { cancelTriggered = true; },
    abortCurrent: mockFn(),
    onClearScreen: mockFn(),
    onExit: () => { exitTriggered = true; },
    onHint: mockFn(),
    onSlash: () => { slashTriggered = true; },
    onToggleHUD: () => { hudToggled = true; },
  };

  const { detach } = attachKeybindings({ ...opts, stdin: mockStdin } as any);

  // 1. Test Ctrl+C -> Exit (Double Ctrl+C within 2s)
  mockStdin.emit('keypress', '', { ctrl: true, name: 'c' });
  assert(!exitTriggered, 'Single Ctrl+C should not exit immediately');
  mockStdin.emit('keypress', '', { ctrl: true, name: 'c' });
  assert(exitTriggered, 'Double Ctrl+C should trigger onExit');

  // 2. Test ESC -> Clear line (when IDLE and no capture)
  mockRl.line = 'hello';
  mockRl.cursor = 5;
  mockStdin.emit('keypress', '', { name: 'escape' });
  assert(mockRl.line === '', 'ESC should clear rl.line when IDLE');

  // 3. Test ESC -> Cancel capture
  const optsCapturing = { ...opts, isCapturing: () => true };
  const { detach: detach2 } = attachKeybindings({ ...optsCapturing, stdin: mockStdin } as any);
  cancelTriggered = false;
  mockStdin.emit('keypress', '', { name: 'escape' });
  assert(cancelTriggered, 'ESC should trigger cancelCapture when capturing');
  detach2();

  // 4. Test F9 -> Toggle HUD
  mockStdin.emit('keypress', '', { name: 'f9' });
  assert(hudToggled, 'F9 should trigger onToggleHUD');

  detach();
  console.log('✅ Keybindings optimized behaviors verified.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ Keybindings test failed:', e.message);
    process.exit(1);
  });
}
