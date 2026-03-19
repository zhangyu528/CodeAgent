import { renderUnifiedDiff } from '../../apps/cli/components/diff_renderer';

function stripAnsi(s: string) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export async function test() {
  console.log('=== Running Unit Test: Diff Renderer ===');

  const oldText = 'line1\nold\nline3\n';
  const newText = 'line1\nnew\nline3\n';

  const diff = renderUnifiedDiff(oldText, newText, 'temp/test.txt', 3);
  const plain = stripAnsi(diff);

  if (!plain.includes('diff --git a/temp/test.txt b/temp/test.txt')) throw new Error('missing diff header');
  if (!plain.includes('--- a/temp/test.txt')) throw new Error('missing --- header');
  if (!plain.includes('+++ b/temp/test.txt')) throw new Error('missing +++ header');
  if (!plain.includes('-old')) throw new Error('missing delete line');
  if (!plain.includes('+new')) throw new Error('missing insert line');
  if (!plain.includes('@@')) throw new Error('missing hunk header');

  console.log('✅ Diff renderer works.');
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ Diff renderer test failed:', e.message);
    process.exit(1);
  });
}
