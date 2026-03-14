import chalk from 'chalk';

export class SlashHintManager {
  private hints: { name: string; description: string }[] = [];

  setHints(hints: { name: string; description: string }[]) {
    this.hints = Array.isArray(hints) ? hints : [];
  }

  getLines(): string[] {
    if (this.hints.length === 0) return [];

    const lines = this.hints.slice(0, 5).map(h => {
      return chalk.dim('   ╰─ ') + chalk.yellow(h.name.padEnd(12)) + chalk.dim(h.description);
    });
    
    lines.unshift(chalk.bold.blue('   💡 Suggestions:'));
    return lines;
  }

  clear() {
    this.hints = [];
  }
}
