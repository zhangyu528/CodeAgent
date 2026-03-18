import { buildHelpLines, dispatchSlash, getDefaultSlashCommands } from '../../apps/cli/components/slash_commands';

export async function test() {
  console.log('=== Running Unit Test: Slash Commands ===');

  const commands = getDefaultSlashCommands();
  const ctxForHelp: any = { commands };

  const helpText = buildHelpLines(ctxForHelp).join('\n');
  if (!helpText.includes('/help')) throw new Error('help output missing /help');
  if (!helpText.includes('/model')) throw new Error('help output missing /model');
  if (helpText.includes('STATUS_BAR')) throw new Error('help output should not include deprecated STATUS_BAR');
  if (!helpText.includes('确认候选/确认选择')) throw new Error('help output missing modal select keybinding hint');

  let gotError = '';
  await dispatchSlash(
    {
      error: (m: string) => {
        gotError = m;
      },
      print: () => {},
      commands,
    },
    '/help',
    null as any,
    null
  );

  if (!gotError.includes('参数异常')) {
    throw new Error('dispatchSlash should guard non-array commands');
  }

  console.log('✅ Slash commands checks passed.');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ Slash commands test failed:', e.message);
    process.exit(1);
  });
}

