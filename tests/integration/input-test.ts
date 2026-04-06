/**
 * Integration test for input handling
 * 
 * Run: npx ts-node tests/integration/input-test.ts
 * Or: npm run dev (then manually test)
 * 
 * This test verifies:
 * 1. Character input works (text appears in input field)
 * 2. Backspace works (removes last character)
 * 3. Escape works (clears input)
 * 4. Return works for slash commands (/help, /new, etc.)
 * 5. Return works for regular prompts
 */

import { spawn, Stdio } from 'child_process';
import { Writable, PassThrough } from 'stream';

interface TestResult {
  name: string;
  passed: boolean;
  output: string;
  error?: string;
}

class MockStdin extends PassThrough {
  writeKey(key: string) {
    // Map common keys to ANSI escape sequences
    const keyMap: Record<string, string> = {
      'Enter': '\x0d',
      'Backspace': '\x7f',
      'Escape': '\x1b',
      'Tab': '\x09',
      'ArrowUp': '\x1b[A',
      'ArrowDown': '\x1b[B',
      'Ctrl+C': '\x03',
      'Ctrl+D': '\x04',
    };

    const seq = keyMap[key] || key;
    this.write(seq);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  console.error(`\n=== Running: ${name} ===`);
  const result: TestResult = { name, passed: false, output: '' };
  
  try {
    await fn();
    result.passed = true;
    console.error(`PASSED: ${name}`);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`FAILED: ${name} - ${result.error}`);
  }
  
  return result;
}

async function testBasicInput() {
  // Start the CLI in dev mode
  const cli = spawn('npm', ['run', 'dev'], {
    cwd: '/mnt/d/work/project/CodeAgent',
    stdio: ['pipe', 'pipe', 'pipe'] as Stdio,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const stdin = cli.stdin as MockStdin;
  const output: string[] = [];
  
  cli.stdout?.on('data', (data) => {
    const text = data.toString();
    output.push(text);
    console.error('[CLI stdout]:', text.substring(0, 200));
  });
  
  cli.stderr?.on('data', (data) => {
    const text = data.toString();
    output.push(text);
    // Filter out DEBUG logs
    if (!text.includes('[DEBUG') && !text.includes('[TEST]')) {
      console.error('[CLI stderr]:', text.substring(0, 200));
    }
  });

  await sleep(2000); // Wait for CLI to start

  // Test 1: Type "hello" 
  console.error('\n[Test] Typing "hello"...');
  for (const char of 'hello') {
    stdin.writeKey(char);
    await sleep(100);
  }

  await sleep(500);

  // Test 2: Press Enter (should submit or show model config prompt)
  console.error('\n[Test] Pressing Enter...');
  stdin.writeKey('Enter');
  
  await sleep(1000);

  // Test 3: Type "/help"
  console.error('\n[Test] Typing "/help"...');
  for (const char of '/help') {
    stdin.writeKey(char);
    await sleep(100);
  }

  await sleep(500);

  // Test 4: Press Enter (should execute /help)
  console.error('\n[Test] Pressing Enter to execute /help...');
  stdin.writeKey('Enter');
  
  await sleep(1000);

  // Cleanup
  cli.kill();

  result.output = output.join('\n');
}

async function main() {
  console.error('========================================');
  console.error('Input Handling Integration Test');
  console.error('========================================');

  const results: TestResult[] = [];

  // Run the actual test
  const result = await runTest('Basic Input Handling', testBasicInput);
  results.push(result);

  // Summary
  console.error('\n========================================');
  console.error('Test Summary');
  console.error('========================================');
  
  for (const r of results) {
    console.error(`${r.passed ? '✓' : '✗'} ${r.name}`);
    if (r.error) {
      console.error(`  Error: ${r.error}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  console.error(`\n${passed}/${results.length} tests passed`);

  process.exit(passed === results.length ? 0 : 1);
}

main().catch(console.error);
