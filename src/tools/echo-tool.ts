import { z } from "zod";
import type { Tool } from "./tool-system.js";

const parameters = z.object({
  text: z.string(),
});

export const EchoTool: Tool<typeof parameters> = {
  name: "echo",
  description: "Echo back the provided text.",
  parameters,
  async execute(args) {
    return { echo: args.text };
  },
};
