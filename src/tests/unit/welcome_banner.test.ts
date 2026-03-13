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

  // 1. 验证版本号显示
  assert(banner.includes('CodeAgent CLI v1.2.3'), 'Banner should contain correct version');

  // 2. 验证 Provider 显示
  assert(banner.includes('Provider: deepseek'), 'Banner should contain current provider');
  assert(banner.includes('(可用: deepseek, glm)'), 'Banner should list available providers');

  // 3. 验证已移除的信息 (F10 要求)
  assert(!banner.includes('状态栏显示'), 'Banner should NOT contain status bar info');
  assert(!banner.includes('/help'), 'Banner should NOT contain help tip');

  // 4. 验证间隔 (空行)
  const lines = banner.split('\n').map(l => l.trim());
  // 查找包含版本的那一行和包含 provider 的那一行，确认它们之间有空行
  const versionIdx = lines.findIndex(l => l.includes('CodeAgent CLI'));
  const providerIdx = lines.findIndex(l => l.includes('Provider:'));
  
  // 在 renderWelcomeCard 的实现中，right 数组索引 0 是版本，1 是空行，2 是 provider
  // 加上左侧图案的偏移，我们需要确保它们之间确实存在视觉间隔
  assert(providerIdx > versionIdx + 1, 'There should be a gap between version and provider');

  console.log('✅ Welcome banner content and formatting verified.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ Welcome banner test failed:', e.message);
    process.exit(1);
  });
}
