import * as fs from 'fs/promises';
import * as path from 'path';

import { LLMEngine } from '../../core/llm/engine';
import { AgentController } from '../../core/controller/agent_controller';
import { SecurityLayer } from '../../core/controller/security_layer';
import { MemoryManager } from '../../core/controller/memory_manager';
import { MockProvider } from '../../core/llm/mock_provider';

import { ReadFileTool } from '../../core/tools/read_file_tool';
import { WriteFileTool } from '../../core/tools/write_file_tool';
import { ReplaceContentTool } from '../../core/tools/replace_content_tool';
import { UIAdapter } from '../../apps/cli/components/ui_adapter';

class TestUI implements UIAdapter {
  public diffsShown: number = 0;
  constructor(private confirm: boolean) {}

  isInteractive(): boolean { return true; }
  async showDiff(_filePath: string, _diffText: string): Promise<void> { this.diffsShown++; }
  async confirmDiff(_filePath: string, _diffText: string): Promise<boolean> { return this.confirm; }
  async confirmRisk(): Promise<boolean> { return true; }
  async selectOne(): Promise<string> { return ''; }
  async selectMany(): Promise<string[]> { return []; }
  async openEditor(): Promise<string> { return ''; }
  async suspendInput<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
}

async function exists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

export async function test() {
  console.log('=== Running Integration Test: Diff Preview Middleware ===');

  const engine = new LLMEngine();
  engine.registerProvider(new MockProvider());

  const file = path.resolve(process.cwd(), 'temp/f8_diff_test.txt');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, 'OLD', 'utf-8');

  // Deny
  {
    const ui = new TestUI(false);
    const security = new SecurityLayer(process.cwd(), async () => true);
    const controller = new AgentController(
      engine,
      [new ReadFileTool(), new WriteFileTool(), new ReplaceContentTool()],
      'mock',
      security,
      new MemoryManager(4000),
      { ui }
    );

    await controller.run('F8_DIFF_TEST_WRITE');

    const content = await fs.readFile(file, 'utf-8');
    if (content !== 'OLD') throw new Error('expected file unchanged when diff denied');
    if (ui.diffsShown === 0) throw new Error('expected diff to be shown');
  }

  // Allow
  {
    const ui = new TestUI(true);
    const security = new SecurityLayer(process.cwd(), async () => true);
    const controller = new AgentController(
      engine,
      [new ReadFileTool(), new WriteFileTool(), new ReplaceContentTool()],
      'mock',
      security,
      new MemoryManager(4000),
      { ui }
    );

    await controller.run('F8_DIFF_TEST_WRITE');

    const content = await fs.readFile(file, 'utf-8');
    if (!content.includes('Hello from diff test')) throw new Error('expected file overwritten when diff approved');
    if (ui.diffsShown === 0) throw new Error('expected diff to be shown');
  }

  // Replace-content deny
  {
    const replaceFile = path.resolve(process.cwd(), 'temp/f8_replace_test.txt');
    await fs.writeFile(replaceFile, 'AAA OLD BBB', 'utf-8');

    const ui = new TestUI(false);
    const security = new SecurityLayer(process.cwd(), async () => true);
    const controller = new AgentController(
      engine,
      [new ReadFileTool(), new WriteFileTool(), new ReplaceContentTool()],
      'mock',
      security,
      new MemoryManager(4000),
      { ui }
    );

    await controller.run('F8_DIFF_TEST_REPLACE');
    const content = await fs.readFile(replaceFile, 'utf-8');
    if (content !== 'AAA OLD BBB') throw new Error('expected replace file unchanged when diff denied');
  }

  console.log('✅ Diff preview middleware works.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ Diff preview middleware test failed:', e.message);
    process.exit(1);
  });
}
