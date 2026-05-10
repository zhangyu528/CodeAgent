/**
 * Settings API - facade for agent's SettingsManager
 */

import { SettingsManager } from '@mariozechner/pi-coding-agent';

let settingsManagerInstance: SettingsManager | null = null;

export function getSettingsManager(): SettingsManager {
  if (!settingsManagerInstance) {
    settingsManagerInstance = SettingsManager.create();
  }
  return settingsManagerInstance;
}
