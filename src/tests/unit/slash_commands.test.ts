import { buildHelpLines, getDefaultSlashCommands } from '../../cli/slash_commands';

async function testSlashHelp() {
  console.log('=== Running Unit Test: Slash Commands Help ===');

  const commands = getDefaultSlashCommands();
  const ctx: any = { commands };

  const lines = buildHelpLines(ctx);
  const text = lines.join('\n');

  if (!text.includes('/help')) throw new Error('help output missing /help');
  if (!text.includes('/model')) throw new Error('help output missing /model');
  if (!text.includes('STATUS_BAR')) throw new Error('help output missing STATUS_BAR config');

  console.log('✅ Slash commands help works.');
}

testSlashHelp().catch(e => {
  console.error('❌ Slash commands help test failed:', e.message);
  process.exit(1);
});
