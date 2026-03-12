import * as fs from 'fs/promises';
import * as path from 'path';
import { buildCompleter } from '../../cli/readline_completer';

async function testCompleter() {
  console.log('=== Running Unit Test: Readline Completer ===');

  const base = path.resolve(process.cwd(), 'temp/f8_completer');
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(path.join(base, 'alpha.txt'), 'a', 'utf-8');
  await fs.mkdir(path.join(base, 'srcdir'), { recursive: true });

  const completer = buildCompleter({ cwd: base, slashCommands: ['/clear', '/model'] });

  const res1 = await new Promise<[string[], string]>(resolve => {
    completer('/c', (_err, out) => resolve(out));
  });
  if (!res1[0].includes('/clear')) throw new Error('slash completion missing /clear');

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

testCompleter().catch(e => {
  console.error('❌ Readline completer test failed:', e.message);
  process.exit(1);
});
