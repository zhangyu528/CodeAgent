import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { ConfigStore } from "../config/config-store.js";
import { resolveConfig } from "../config/resolve-config.js";

const program = new Command();
const store = new ConfigStore();

program.name("codeagent").description("CodeAgent CLI").version("0.1.0");

program
  .command("config")
  .description("Manage configuration")
  .argument("[action]", "get|set|list")
  .argument("[key]", "config key")
  .argument("[value]", "config value")
  .action(async (action, key, value) => {
    const current = await store.read();

    if (!action || action === "list") {
      const resolved = await resolveConfig();
      console.log(JSON.stringify(resolved, null, 2));
      return;
    }

    if (action === "get") {
      if (!key) {
        console.error("Missing key for config get");
        process.exit(1);
      }
      console.log(current[key] ?? "");
      return;
    }

    if (action === "set") {
      let resolvedKey = key;
      let resolvedValue = value;
      if (resolvedKey && resolvedKey.includes("=") && resolvedValue === undefined) {
        const parts = resolvedKey.split("=");
        resolvedKey = parts[0];
        resolvedValue = parts.slice(1).join("=");
      }
      if (!resolvedKey) {
        console.error("Missing key for config set");
        process.exit(1);
      }
      if (resolvedValue === undefined) {
        resolvedValue = await input({ message: `Value for ${resolvedKey}:` });
      }
      current[resolvedKey] = resolvedValue;
      await store.write(current);
      console.log(`Saved ${resolvedKey} to ${store.getPath()}`);
      return;
    }

    console.error(`Unknown action: ${action}`);
    process.exit(1);
  });

program.parseAsync(process.argv);
