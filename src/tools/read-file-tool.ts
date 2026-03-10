import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Tool } from "./tool-system.js";

const parameters = z.object({
  path: z.string().min(1),
  encoding: z.string().optional(),
});

const repoRoot = process.cwd();

export const ReadFileTool: Tool<typeof parameters> = {
  name: "read_file",
  description: "Read a local text file from the repository workspace.",
  parameters,
  async execute(args) {
    const resolved = path.resolve(repoRoot, args.path);
    const relative = path.relative(repoRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Path is outside the workspace: only repository files are allowed.");
    }

    const encoding = args.encoding ?? "utf-8";
    const content = await readFile(resolved, { encoding: encoding as BufferEncoding });
    return { path: args.path, content };
  },
};
