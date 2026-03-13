import { ContextInformer } from '../../controller/context_informer';
import * as fs from 'fs/promises';
import * as path from 'path';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function test() {
  console.log('=== Running Unit Test: ContextInformer ===');
  const baseTemp = path.join(process.cwd(), 'temp');
  await fs.mkdir(baseTemp, { recursive: true });

  const testDir = await fs.mkdtemp(path.join(baseTemp, 'context_informer_'));
  try {
    // Test 1: Basic snapshot content
    await fs.writeFile(
      path.join(testDir, 'README.md'),
      '# Demo Project\n\nA short description for testing.\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'demo-project',
        version: '0.1.0',
        description: 'demo package',
        scripts: { test: 'echo ok', build: 'tsc' },
        dependencies: { chalk: '^4.1.2' }
      }, null, 2),
      'utf-8'
    );
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'src', 'index.ts'), 'console.log(1);', 'utf-8');

    const informer = new ContextInformer();
    const snapshot = await informer.buildBootSnapshot(testDir);

    if (!snapshot.includes('Demo Project')) {
      throw new Error('Snapshot missing README title.');
    }
    if (!snapshot.includes('demo-project')) {
      throw new Error('Snapshot missing package name.');
    }
    if (!snapshot.includes('test')) {
      throw new Error('Snapshot missing scripts summary.');
    }

    console.log('✅ Basic snapshot content included.');

    // Test 2: Token limit enforcement
    const hugeReadme = '# Big Project\n\n' + 'A'.repeat(5000);
    await fs.writeFile(path.join(testDir, 'README.md'), hugeReadme, 'utf-8');
    for (let i = 0; i < 80; i++) {
      const dirPath = path.join(testDir, `dir_${i}`);
      await fs.mkdir(path.join(dirPath, 'child'), { recursive: true });
      await fs.writeFile(path.join(dirPath, 'child', 'file.txt'), 'x', 'utf-8');
    }

    const snapshot2 = await informer.buildBootSnapshot(testDir);
    const tokens = estimateTokens(snapshot2);
    if (tokens > 500) {
      throw new Error(`Snapshot exceeds 500 tokens: ${tokens}`);
    }

    console.log('✅ Snapshot token limit enforced.');
    console.log('\n=== ContextInformer Unit Test Pass ===');
  } finally {
    await fs.rm(testDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ ContextInformer Test Failed:', e.message);
    process.exit(1);
  });
}
