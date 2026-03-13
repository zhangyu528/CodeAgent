import { TelemetryMonitor } from '../../utils/logger';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function test() {
  console.log('=== Running Unit Test: TelemetryMonitor (Per Provider) ===');

  const tm = new TelemetryMonitor();
  tm.record('openai', 10, 20);
  tm.record('openai', 5, 5);
  tm.record('deepseek', 7, 0);

  const summary = tm.getSummary();
  assert(summary.totalTokens === 47, `Expected totalTokens=47, got ${summary.totalTokens}`);

  const by = summary.byProvider.reduce((acc: any, p: any) => {
    acc[p.provider] = p;
    return acc;
  }, {});

  assert(!!by.openai, 'Missing openai in byProvider');
  assert(!!by.deepseek, 'Missing deepseek in byProvider');
  assert(by.openai.totalTokens === 40, `Expected openai totalTokens=40, got ${by.openai.totalTokens}`);
  assert(by.deepseek.totalTokens === 7, `Expected deepseek totalTokens=7, got ${by.deepseek.totalTokens}`);

  console.log('✅ TelemetryMonitor aggregates token usage by provider.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ TelemetryMonitor Test Failed:', e.message);
    process.exit(1);
  });
}
