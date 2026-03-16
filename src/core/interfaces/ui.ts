/**
 * IUIAdapter defines the contract between the Core logic and the UI implementation.
 */
export interface IUIAdapter {
  // --- Output (One-way) ---
  
  /**
   * Called when the agent is thinking.
   */
  onThink(text: string): void;

  /**
   * Called when the agent is streaming a response.
   */
  onStream(token: string): void;

  /**
   * Called when a tool starts execution.
   */
  onToolStart(name: string, input: any): void;

  /**
   * Called when a tool finishes execution.
   */
  onToolEnd(name: string, output: any): void;

  /**
   * Called when the global status/mode changes.
   */
  onStatusUpdate(status: any): void;

  /**
   * Print a plain message to the UI.
   */
  print(message: string): void;

  /**
   * Print an error message to the UI.
   */
  error(message: string): void;

  /**
   * Log information to the UI.
   */
  info(message: string): void;

  // --- Interaction (Request-Response) ---

  /**
   * Ask the user for a text input.
   */
  ask(question: string): Promise<string>;

  /**
   * Ask the user for confirmation (Yes/No).
   */
  confirm(message: string): Promise<boolean>;

  /**
   * Ask the user to select one option from a list.
   */
  selectOne(message: string, choices: string[], opts?: { default?: string | undefined }): Promise<string>;

  /**
   * Ask the user to select multiple options from a list.
   */
  selectMany(message: string, choices: string[], opts?: { defaults?: string[] | undefined }): Promise<string[]>;

  /**
   * Open an editor for long text input.
   */
  openEditor(message: string, initial?: string | undefined): Promise<string>;

  /**
   * Suspend input while running a block of code (useful for preventing concurrent inputs).
   */
  suspendInput<T>(fn: () => Promise<T>): Promise<T>;
}
