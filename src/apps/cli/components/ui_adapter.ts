export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type RiskPrompt = {
  type: 'security';
  level: RiskLevel;
  title: string;
  detail?: string;
  reason?: string;
};

export interface UIAdapter {
  isInteractive(): boolean;

  showDiff(filePath: string, diffText: string): Promise<void>;
  confirmDiff(filePath: string, diffText: string, defaultYes?: boolean): Promise<boolean>;

  confirmRisk(prompt: string | RiskPrompt): Promise<boolean>;

  selectOne(message: string, choices: string[], opts?: { default?: string; enableSearch?: boolean }): Promise<string>;
  selectMany(message: string, choices: string[], opts?: { defaults?: string[]; enableSearch?: boolean }): Promise<string[]>;
  openEditor(message: string, initial?: string): Promise<string>;
  suspendInput<T>(fn: () => Promise<T>): Promise<T>;
  }

export function parseRiskPrompt(input: string | RiskPrompt): RiskPrompt {
  if (typeof input !== 'string') return input;

  const trimmed = input.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && obj.type === 'security' && obj.level && obj.title) {
        return obj as RiskPrompt;
      }
    } catch {
      // ignore
    }
  }

  // Fallback heuristic
  const lower = trimmed.toLowerCase();
  let level: RiskLevel = 'MEDIUM';
  if (lower.includes('rm ') || lower.includes('rm -rf') || lower.includes('mkfs') || lower.includes('format')) level = 'HIGH';
  if (lower.includes('npm install') || lower.includes('curl ') || lower.includes('wget ')) level = 'MEDIUM';

  return {
    type: 'security',
    level,
    title: 'Security approval required',
    detail: trimmed,
  };
}
