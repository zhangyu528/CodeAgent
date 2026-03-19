import * as fs from 'fs/promises';
import * as path from 'path';
import { buildCompleter } from '../../apps/cli/components/readline_completer';

export async function test() {
  console.log('=== Running Unit Test: Readline Completer ===');

  const base = path.resolve(process.cwd(), 'temp/f8_completer');
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(path.join(base, 'alpha.txt'), 'a', 'utf-8');
  await fs.mkdir(path.join(base, 'srcdir'), { recursive: true });

  const completer = buildCompleter({
    cwd: base,
    slashCommands: ['/provider', '/model', '/help'],
    getModelProviders: () => ['glm', 'openai', 'deepseek'],
  });

  const res1 = await new Promise<[string[], string]>(resolve => {
    completer('/p', (_err, out) => resolve(out));
  });
  if (!res1[0].includes('/provider')) throw new Error('slash completion missing /provider');

  const resModel = await new Promise<[string[], string]>(resolve => {
    completer('/model g', (_err, out) => resolve(out));
  });
  if (!resModel[0].includes('glm')) throw new Error('model provider completion missing glm');

  const res2 = await new Promise<[string[], string]>(resolve => {
    completer('a', (_err, out) => resolve(out));
  });
  if (!res2[0].some(x => x.includes('alpha.txt'))) throw new Error('path completion missing alpha.txt');

  const res3 = await new Promise<[string[], string]>(resolve => {
    completer('s', (_err, out) => resolve(out));
  });
  if (!res3[0].some(x => x.endsWith('srcdir/'))) throw new Error('dir completion missing srcdir/');

  console.log('✅ Readline completer works.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ Readline completer test failed:', e.message);
    process.exit(1);
  });
}

