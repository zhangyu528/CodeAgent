import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type ConfigRecord = Record<string, string>;

export interface ConfigStoreOptions {
  configPath?: string;
}

export class ConfigStore {
  private configPath: string;

  constructor(options?: ConfigStoreOptions) {
    this.configPath =
      options?.configPath ?? path.resolve(os.homedir(), ".codeagent", "config.json");
  }

  async read(): Promise<ConfigRecord> {
    try {
      const raw = await readFile(this.configPath, "utf-8");
      return JSON.parse(raw) as ConfigRecord;
    } catch {
      return {};
    }
  }

  async write(values: ConfigRecord): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(values, null, 2), "utf-8");
    await chmod(this.configPath, 0o600);
  }

  getPath(): string {
    return this.configPath;
  }
}
