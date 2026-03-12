import { ConfigStore } from "./config-store.js";

export interface ResolvedConfig {
  values: Record<string, string>;
  sources: Record<string, "cli" | "config" | "env">;
}

export async function resolveConfig(cliOverrides: Record<string, string> = {}): Promise<ResolvedConfig> {
  const store = new ConfigStore();
  const configValues = await store.read();

  const envValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      envValues[key] = value;
    }
  }

  const values: Record<string, string> = {};
  const sources: Record<string, "cli" | "config" | "env"> = {};

  for (const [key, value] of Object.entries(envValues)) {
    values[key] = value;
    sources[key] = "env";
  }

  for (const [key, value] of Object.entries(configValues)) {
    values[key] = value;
    sources[key] = "config";
  }

  for (const [key, value] of Object.entries(cliOverrides)) {
    values[key] = value;
    sources[key] = "cli";
  }

  return { values, sources };
}
