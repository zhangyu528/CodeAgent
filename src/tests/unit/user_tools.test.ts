import { UserSelectTool } from '../../core/tools/user_select_tool';
import { UserCheckboxTool } from '../../core/tools/user_checkbox_tool';
import { UserEditorTool } from '../../core/tools/user_editor_tool';
import { UIAdapter } from '../../apps/cli/components/ui_adapter';

class MockUI implements UIAdapter {
  isInteractive(): boolean { return true; }
  async showDiff(): Promise<void> {}
  async confirmDiff(): Promise<boolean> { return true; }
  async confirmRisk(): Promise<boolean> { return true; }
  async selectOne(_m: string, _c: string[]): Promise<string> { return 'B'; }
  async selectMany(_m: string, _c: string[]): Promise<string[]> { return ['A', 'C']; }
  async openEditor(): Promise<string> { return 'edited'; }
  async suspendInput<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
}

export async function test() {
  console.log('=== Running Unit Test: User Tools ===');

  const ui = new MockUI();

  const sel = new UserSelectTool(ui);
  const out1 = JSON.parse(await sel.execute({ message: 'pick', choices: ['A', 'B', 'C'] }));
  if (out1.selected !== 'B') throw new Error('user_select mismatch');

  const chk = new UserCheckboxTool(ui);
  const out2 = JSON.parse(await chk.execute({ message: 'pick', choices: ['A', 'B', 'C'] }));
  if (!Array.isArray(out2.selected) || out2.selected.join(',') !== 'A,C') throw new Error('user_checkbox mismatch');

  const ed = new UserEditorTool(ui);
  const out3 = JSON.parse(await ed.execute({ message: 'edit', initial: 'x' }));
  if (out3.text !== 'edited') throw new Error('user_editor mismatch');

  console.log('✅ User tools works.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ User tools test failed:', e.message);
    process.exit(1);
  });
}
