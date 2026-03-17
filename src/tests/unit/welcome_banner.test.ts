import { renderWelcomeCard } from '../../cli/welcome_card';
import chalk = require('chalk');

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function test() {
  console.log('=== Running Unit Test: Welcome Banner ===');

  const opts = {
    version: '1.2.3',
    provider: 'deepseek',
    providers: ['deepseek', 'glm'],
  };

  const banner = renderWelcomeCard(opts);

  assert(banner.includes('v1.2.3'), 'Banner should contain correct version');

  assert(banner.includes('Provider:'), 'Banner should contain provider info');
  assert(banner.includes('deepseek'), 'Banner should contain current provider');
  assert(banner.includes('deepseek, glm'), 'Banner should list available providers');

  assert(!banner.includes('状态栏显示'), 'Banner should NOT contain status bar info');
  assert(!banner.includes('/help'), 'Banner should NOT contain help tip');

  console.log('✅ Welcome banner content and formatting verified.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ Welcome banner test failed:', e.message);
    process.exit(1);
  });
}
