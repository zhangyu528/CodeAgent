import { z } from "zod";
import type { Tool } from "./tool-system.js";
import { runCommand } from "../execution/runner.js";
import { SecurityLayer } from "../security/security-layer.js";

const parameters = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  timeout_ms: z.number().int().positive().optional(),
});

export const RunCommandTool: Tool<typeof parameters> = {
  name: "run_command",
  description: "Run a local command in the repository workspace.",
  parameters,
  async execute(args) {
    const resolved = splitCommand(args.cmd, args.args);
    const securityLayer = new SecurityLayer(process.cwd());
    const result = await runCommand(resolved.cmd, resolved.args, {
      cwd: args.cwd,
      timeoutMs: args.timeout_ms,
      securityLayer,
    });
    return result;
  },
};

function splitCommand(cmd: string, args?: string[]) {
  if (args && args.length > 0) {
    return { cmd, args };
  }
  const parts = cmd.split(/\s+/).filter(Boolean);
  return {
    cmd: parts[0] ?? cmd,
    args: parts.length > 1 ? parts.slice(1) : [],
  };
}
