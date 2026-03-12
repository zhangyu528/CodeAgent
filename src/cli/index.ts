import "dotenv/config";
import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { ConfigStore } from "../config/config-store.js";
import { resolveConfig } from "../config/resolve-config.js";
import { Logger } from "../logging/logger.js";
import { LLMEngine } from "../llm/engine.js";
import { GLMProvider } from "../providers/glm.js";
import { ToolSystem } from "../tools/tool-system.js";
import { EchoTool } from "../tools/echo-tool.js";
import { ReadFileTool } from "../tools/read-file-tool.js";
import { RunCommandTool } from "../tools/run-command-tool.js";
import { AgentController } from "../agent/controller.js";
import { startRepl } from "./repl.js";
import chalk from "chalk";

const program = new Command();
const store = new ConfigStore();
const logger = new Logger();

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
      logger.info("config list");
      console.log(JSON.stringify(resolved, null, 2));
      return;
    }

    if (action === "get") {
      if (!key) {
        logger.error("Missing key for config get");
        process.exit(1);
      }
      logger.info(`config get ${key}`);
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
        logger.error("Missing key for config set");
        process.exit(1);
      }
      if (resolvedValue === undefined) {
        resolvedValue = await input({ message: `Value for ${resolvedKey}:` });
      }
      current[resolvedKey] = resolvedValue;
      await store.write(current);
      logger.info(`config set ${resolvedKey}`, { path: store.getPath() });
      console.log(chalk.green(`Saved ${resolvedKey} to ${store.getPath()}`));
      return;
    }

    logger.error(`Unknown action: ${action}`);
    process.exit(1);
  });

program
  .command("run")
  .description("Run a single task")
  .argument("<task>", "task description")
  .action(async (task) => {
    const { values } = await resolveConfig();
    const apiKey = values.GLM_API_KEY ?? process.env.GLM_API_KEY;
    const model = values.GLM_MODEL ?? process.env.GLM_MODEL;
    const baseUrl = values.GLM_BASE_URL ?? process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
    if (!apiKey || !model) {
      logger.error("Missing GLM_API_KEY or GLM_MODEL");
      process.exit(1);
    }
    const engine = new LLMEngine();
    engine.registerProvider(new GLMProvider({ apiKey, baseUrl }));
    const toolSystem = new ToolSystem([EchoTool, ReadFileTool, RunCommandTool]);
    const controller = new AgentController(engine, toolSystem, "glm");
    console.log(chalk.blue("Running task..."));
    const result = await controller.run(task, model);
    console.log(result);
  });

program
  .command("chat")
  .description("Start interactive REPL")
  .action(async () => {
    const { values } = await resolveConfig();
    const apiKey = values.GLM_API_KEY ?? process.env.GLM_API_KEY;
    const model = values.GLM_MODEL ?? process.env.GLM_MODEL;
    const baseUrl = values.GLM_BASE_URL ?? process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
    if (!apiKey || !model) {
      logger.error("Missing GLM_API_KEY or GLM_MODEL");
      process.exit(1);
    }
    const engine = new LLMEngine();
    engine.registerProvider(new GLMProvider({ apiKey, baseUrl }));
    const toolSystem = new ToolSystem([EchoTool, ReadFileTool, RunCommandTool]);
    const controller = new AgentController(engine, toolSystem, "glm");
    console.log(chalk.blue("Starting REPL..."));
    await startRepl(controller, model);
  });

program.parseAsync(process.argv);
