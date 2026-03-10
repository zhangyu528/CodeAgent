import { z } from "zod";
import type { JSONSchema } from "../types.js";
import type { Tool } from "./tool-system.js";

const parameters = z.object({
  text: z.string(),
});

const jsonSchema: JSONSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "Text to echo back." },
  },
  required: ["text"],
  additionalProperties: false,
};

export const EchoTool: Tool<typeof parameters> = {
  name: "echo",
  description: "Echo back the provided text.",
  parameters,
  jsonSchema,
  async execute(args) {
    return { echo: args.text };
  },
};
