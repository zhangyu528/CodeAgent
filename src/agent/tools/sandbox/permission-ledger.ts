/**
 * Session-scoped Permission Ledger
 * 
 * Tracks which elevated/dangerous tier commands have been approved
 * during the current session. Safe tier commands are auto-approved.
 */

export type CommandTier = 'safe' | 'elevated' | 'dangerous';

interface PermissionEntry {
  tier: CommandTier;
  approvedAt: number;
}

export class PermissionLedger {
  private ledger = new Map<string, PermissionEntry>();

  /**
   * Check if a command is approved for the given tier.
   * Safe tier commands are always approved by default (unless explicitly stored with different tier).
   * For non-safe tiers, the command must be stored with that specific tier.
   */
  has(baseCmd: string, tier: CommandTier): boolean {
    const entry = this.ledger.get(baseCmd);
    if (!entry) return tier === 'safe'; // Unstored commands: safe is default-approved
    return entry.tier === tier; // Must match the specific tier
  }

  /**
   * Approve a command for a given tier.
   */
  approve(baseCmd: string, tier: CommandTier): void {
    this.ledger.set(baseCmd, { tier, approvedAt: Date.now() });
  }

  /**
   * Clear all approvals (called at session end).
   */
  clear(): void {
    this.ledger.clear();
  }

  /**
   * Get the approval entry for a command, if any.
   */
  getEntry(baseCmd: string): PermissionEntry | undefined {
    return this.ledger.get(baseCmd);
  }
}
