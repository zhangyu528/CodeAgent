# Dependency Compatibility Guard

## Problem Statement

CodeAgent uses `zod ^4.3.6` (Zod 4) while its core dependency `@mariozechner/pi-agent-core` may internally use Zod 3 syntax. Zod 4 introduced breaking changes to `z.object()` parameter syntax and other APIs. Without automated detection, this class of incompatibility surfaces only as runtime errors in production — not at `npm install` time, and not in CI unit tests that don't exercise the actual integration path.

Additionally, the project pins `pi-agent-core` with `^0.61.1`, allowing minor/patch updates that could introduce incompatibilities with the Ink 6 / React 19 / Zustand 5 stack.

## Recommended Direction

**Automated Compatibility CI Layer**

Introduce a lightweight runtime compatibility check that runs before the agent initializes — not as a build step, but as the first line of defense at runtime. This check:

1. **Detects Zod version mismatch** — calls a minimal Zod operation (e.g., `z.object({}).parse({})`) and catches errors from syntax incompatibility
2. **Verifies pi-agent-core integration surface** — tests that the agent can be instantiated and that `setTools` accepts the current tool schemas without throwing
3. **Reports actionable errors** — if incompatible, the CLI exits early with a clear message pointing to the specific package and the known-good version range

### Implementation

```typescript
// src/agent/compatibilityCheck.ts
import { z } from 'zod';

export function runCompatibilityCheck(): void {
  // 1. Zod 4 vs 3 syntax check
  try {
    const TestSchema = z.object({
      name: z.string(),
      value: z.number().optional(),
    });
    TestSchema.parse({ name: 'test', value: 1 });
  } catch (err) {
    throw new CompatibilityError(
      'ZOD_VERSION_MISMATCH',
      `Zod 4 syntax check failed. Expected Zod 4, got: ${(err as Error).message}`,
      'Check that pi-agent-core does not pin an older Zod version'
    );
  }

  // 2. pi-agent-core integration surface check
  try {
    const { Agent } = await import('@mariozechner/pi-agent-core');
    const agent = new Agent({ getApiKey: () => undefined });
    // smoke test — don't actually call LLM
  } catch (err) {
    throw new CompatibilityError(
      'AGENT_INIT_FAILED',
      `pi-agent-core initialization failed: ${(err as Error).message}`,
      'Pin @mariozechner/pi-agent-core to a known-working version'
    );
  }
}
```

Run this in `src/agent/agent.ts` before `initAgent()` is called.

## Key Assumptions to Validate

- [ ] `pi-agent-core` is the only external consumer of Zod in the dependency tree
- [ ] Zod version conflict would surface as a runtime error, not a TypeScript compile error
- [ ] The compatibility check adds < 100ms to cold start time

## MVP Scope

1. Create `src/agent/compatibilityCheck.ts` with Zod version and Agent init checks
2. Call `runCompatibilityCheck()` at the top of `getAgent()` in `agent.ts`
3. On `CompatibilityError`, print a user-friendly message and exit with code 1
4. Add a test in `tests/unit/agent/` that mocks Zod/pi-agent-core to verify the error path

## Not Doing (and Why)

- **Lockfile pinning to exact versions**: deferred — `^` ranges are intentional for receiving security patches; the check guards against semantic-break changes, not patch updates
- **Automated dependency update CI**: separate concern, tracked in a future infrastructure idea
- **Locking Zod to a specific major version in package.json**: premature — first confirm whether pi-agent-core actually conflicts with Zod 4

## Open Questions

- Does `bun pm scan` (existing `audit` script) already catch peer-dependency conflicts? If so, this idea may be redundant.
- Should the check be in a separate `precheck` npm script run before `dev` and `start`, or inline in the agent init?
