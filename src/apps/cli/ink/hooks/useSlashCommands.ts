import { useMemo } from 'react';
import { SLASH_COMMANDS } from '../pi_app/utils.js';

interface SlashCommand {
  name: string;
  description: string;
}

export function useSlashCommands(inputValue: string) {
  const isSlashVisible = inputValue.startsWith('/') && !inputValue.includes(' ');

  const filteredCommands = useMemo(() => {
    if (!isSlashVisible) return [];
    return SLASH_COMMANDS.filter(c => c.name.startsWith(inputValue));
  }, [inputValue, isSlashVisible]);

  return {
    isSlashVisible,
    filteredCommands,
  };
}
