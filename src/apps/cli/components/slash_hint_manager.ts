import chalk from 'chalk';

export class SlashHintManager {
  private hints: { name: string; description: string }[] = [];
  private selectedIndex: number = 0;

  setHints(hints: { name: string; description: string }[]) {
    const newHints = Array.isArray(hints) ? hints : [];
    
    // Check if hints content actually changed to avoid resetting selection on every keypress
    const oldNames = this.hints.map(h => h.name).join(',');
    const newNames = newHints.map(h => h.name).join(',');
    
    if (oldNames !== newNames) {
      this.hints = newHints;
      this.selectedIndex = 0;
    }
  }

  moveSelection(delta: number) {
    if (this.hints.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.hints.length) % this.hints.length;
  }

  getSelectedCommand(): { name: string; description: string } | null {
    if (this.hints.length === 0) return null;
    return this.hints[this.selectedIndex] || null;
  }

  getLines(): string[] {
    if (this.hints.length === 0) return [];

    return this.hints.slice(0, 5).map((h, i) => {
      const isSelected = i === this.selectedIndex;
      const prefix = '  '; // Aligned with the '❯ ' prompt (width = 2)
      const name = isSelected ? chalk.cyan.bold(h.name.padEnd(12)) : chalk.cyan.dim(h.name.padEnd(12));
      const desc = isSelected ? chalk.white(h.description) : chalk.dim(h.description);
      
      return `${prefix}${name} ${desc}`;
    });
  }

  clear() {
    this.hints = [];
    this.selectedIndex = 0;
  }
}
