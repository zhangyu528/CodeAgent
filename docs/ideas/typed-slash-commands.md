# Typed Slash Commands — Parameter Validation at the Boundary

## Problem Statement

CodeAgent's slash commands (`/help`, `/model`, `/new`, `/history`, `/resume`) are dispatched via a string-based registry in `hermes_cli/commands.py`. Each command handler receives a raw string argument with no validation — malformed inputs cause runtime errors deep in the handler rather than clean user-facing validation errors. The project uses Zod 4 for tool parameter validation, but slash commands get none of this treatment.

## Recommended Direction

**Zod-Schema-Validated Slash Command Registry**

Define a `CommandDef` type that includes an optional Zod schema for arguments. The command dispatcher validates input against the schema before calling the handler. Invalid input returns a formatted error to the user immediately, rather than crashing or producing confusing behavior.

```typescript
import { z } from 'zod';

interface CommandDef {
  name: string;
  description: string;
  category: 'Session' | 'Configuration' | 'Tools & Skills' | 'Info' | 'Exit';
  aliases?: string[];
  argsSchema?: z.ZodType<unknown>;  // NEW: optional Zod schema
  argsHint?: string;
  cliOnly?: boolean;
}

const COMMANDS: CommandDef[] = [
  {
    name: 'model',
    description: 'Switch the active LLM model',
    category: 'Configuration',
    argsSchema: z.object({
      provider: z.enum(['openai', 'anthropic', 'minimax', 'zhipu']).optional(),
      model: z.string().optional(),
    }),
    argsHint: '[provider] [model]',
  },
  // ...
];
```

The dispatcher:
```typescript
async function dispatchCommand(raw: string): Promise<string> {
  const { name, args } = parseCommand(raw);
  const def = resolveCommand(name);
  
  if (def.argsSchema) {
    const result = def.argsSchema.safeParse(parseArgs(args));
    if (!result.success) {
      return formatZodError(result.error);  // Clean user message
    }
    return def.handler(result.data);
  }
  
  return def.handler(args);
}
```

## Key Assumptions to Validate

- [ ] The current command dispatcher in `hermes_cli/commands.py` can be refactored without breaking the Telegram/Slack gateway integration
- [ ] Zod 4 schemas are backward-compatible enough that `argsSchema` patterns used for tools work identically for slash commands
- [ ] The performance cost of `safeParse` on every command dispatch is negligible (<1ms)

## MVP Scope

**What's in:**
- Add `argsSchema?: z.ZodType<unknown>` field to `CommandDef` interface
- Refactor `resolveCommand()` and `dispatchCommand()` to accept `argsSchema`
- Add schemas for the 5 existing commands: `/model`, `/new`, `/history`, `/resume`, `/help`
- Return formatted Zod validation errors (with `argsHint` as usage example) on failure
- Add unit tests for the dispatcher with invalid inputs

**What's out:**
- Auto-generated `/help` output for command schemas (future)
- Schema-based shell completion (future)
- Changing the gateway command dispatch (separate PR)

## Not Doing (and Why)

- **Retroactive validation for all tool parameters**: Tools already have Zod schemas in their definitions; this idea only covers slash commands
- **Breaking the gateway dispatch**: The gateway (`gateway/run.py`) has its own command hooks; this is a CLI-only MVP
- **Dynamic schema loading**: Not needed for the MVP; schemas are co-located with command definitions

## Open Questions

1. Should argument schemas be required or optional? (Optional in MVP — backward-compatible)
2. How should the dispatcher handle commands with no arguments vs. optional arguments vs. required arguments?
3. Should type inference be used so handler functions are typed based on the schema?
