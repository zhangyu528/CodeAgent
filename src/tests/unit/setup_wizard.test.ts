import { generateEnvContent } from '../../cli/setup_wizard';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function test() {
  console.log('=== Running Unit Test: setup_wizard (generateEnvContent) ===');

  // Test 1: New file generation
  const config1 = { DEFAULT_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-123' };
  const out1 = generateEnvContent(config1, '');
  assert(out1.includes('DEFAULT_PROVIDER=deepseek'), 'out1 should have provider');
  assert(out1.includes('DEEPSEEK_API_KEY=sk-123'), 'out1 should have key');

  // Test 2: Update existing template
  const template2 = '# My Config\nDEEPSEEK_API_KEY=\nDEEPSEEK_MODEL=old\n';
  const config2 = { DEEPSEEK_API_KEY: 'sk-new', DEEPSEEK_MODEL: 'new-coder' };
  const out2 = generateEnvContent(config2, template2);
  assert(out2.includes('# My Config'), 'out2 should keep comment');
  assert(out2.includes('DEEPSEEK_API_KEY=sk-new'), 'out2 should update key');
  assert(out2.includes('DEEPSEEK_MODEL=new-coder'), 'out2 should update model');
  assert(!out2.includes('DEEPSEEK_MODEL=old'), 'out2 should not have old model');

  // Test 3: Append new values
  const template3 = 'EXISTING=123';
  const config3 = { NEW_VAL: '456' };
  const out3 = generateEnvContent(config3, template3);
  assert(out3.includes('EXISTING=123'), 'out3 should keep existing');
  assert(out3.includes('NEW_VAL=456'), 'out3 should append new');

  console.log('✅ generateEnvContent correctly generates .env content.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ setup_wizard test failed:', e.message);
    process.exit(1);
  });
}
