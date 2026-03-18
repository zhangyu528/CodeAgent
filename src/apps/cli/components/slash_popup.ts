import blessed from 'blessed';
import { SlashCommandDef } from './slash_commands';

export class SlashCommandPopup {
  private list: ReturnType<typeof blessed.list>;
  private items: SlashCommandDef[] = [];
  private filteredItems: SlashCommandDef[] = [];
  private visible = false;

  constructor(
    private screen: ReturnType<typeof blessed.screen>,
    commands: SlashCommandDef[],
    private anchor: ReturnType<typeof blessed.box>
  ) {
    this.items = commands;

    // Mount popup on screen (not input container) so it won't be clipped by anchor height.
    this.list = blessed.list({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '80%',
      height: 'shrink',
      items: [],
      interactive: false,
      style: {
        bg: 'blue',
        fg: 'white',
        selected: {
          bg: 'cyan',
          fg: 'black',
          bold: true,
        },
        border: {
          fg: 'blue',
        },
      },
      border: 'line',
      hidden: true,
    });
  }

  setCommands(commands: SlashCommandDef[]) {
    this.items = commands;
  }

  setHints(hints: { name: string; description: string }[]) {
    this.filteredItems = hints.map(h => ({
      name: h.name,
      usage: h.name,
      description: h.description,
      category: 'General',
      handler: async () => {},
    }));
    this.renderList();
  }

  showAll() {
    this.filteredItems = this.items.slice();
    this.renderList();
  }

  update(input: string): boolean {
    if (!input.startsWith('/')) {
      this.hide();
      return false;
    }

    const trimmedInput = input.trim();
    if (input.includes(' ') && trimmedInput.split(' ').length > 1) {
      this.hide();
      return false;
    }

    const prefix = trimmedInput;
    this.filteredItems = this.items.filter(c => c.name.startsWith(prefix));
    return this.renderList();
  }

  private placeNearAnchor(height: number): void {
    const anchorAny = this.anchor as any;
    const top = typeof anchorAny.atop === 'number' ? anchorAny.atop : 0;
    const left = typeof anchorAny.aleft === 'number' ? anchorAny.aleft : 0;
    const width = typeof anchorAny.width === 'number' ? anchorAny.width : Math.max((this.screen.width as number) - 4, 20);

    const popupWidth = Math.max(30, Math.min(width - 2, (this.screen.width as number) - 4));
    const popupTop = Math.max(0, top - height - 1);
    const popupLeft = Math.max(0, Math.min(left + 1, (this.screen.width as number) - popupWidth - 1));

    this.list.top = popupTop;
    this.list.left = popupLeft;
    this.list.width = popupWidth;
  }

  private renderList(): boolean {
    if (this.filteredItems.length === 0) {
      this.hide();
      return false;
    }

    const listContent = this.filteredItems.map(c => {
      const name = c.name.padEnd(12);
      return `${name} ${c.description}`;
    });

    this.list.setItems(listContent);
    const height = Math.min(this.filteredItems.length + 2, 8);
    this.list.height = height;
    this.placeNearAnchor(height as number);

    this.show();
    this.list.select(0);
    this.screen.render();
    return true;
  }

  show() {
    if (!this.visible) {
      this.list.show();
      this.list.setFront();
      this.visible = true;
      this.screen.render();
    }
  }

  hide() {
    if (this.visible) {
      this.list.hide();
      this.visible = false;
      this.screen.render();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  moveSelection(delta: number) {
    if (!this.visible) return;
    if (delta > 0) this.list.down(delta);
    if (delta < 0) this.list.up(Math.abs(delta));
    this.screen.render();
  }

  selectNext() {
    this.moveSelection(1);
  }

  selectPrev() {
    this.moveSelection(-1);
  }

  getCurrentSelection(): string | null {
    if (!this.visible || this.filteredItems.length === 0) return null;
    const selectedIndex = (this.list as any).selected;
    const cmd = this.filteredItems[selectedIndex];
    return cmd ? cmd.name : null;
  }
}
