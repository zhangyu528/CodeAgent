# Zod Version Compatibility Guard

## Problem Statement

CodeAgent uses Zod 4.3.6 directly in `compatibilityCheck.ts`, but `@mariozechner/pi-agent-core` internally also uses Zod — potentially a different version. When `z.version` returned `undefined` in Zod 4.3.6 (breaking `compatibilityCheck.test.ts`), there was no systematic way to detect which Zod APIs were safe to use across the boundary between app code and the pi-agent-core dependency. The `compatibilityCheck` module is the only version guard, but it only checks the app-level Zod, not the dependency's Zod.

## Recommended Direction

**Build a Zod Compatibility Shim + Version Arbitration Layer**

Create a shared `src/agent/zod-compat.ts` that:
1. Detects which Zod version is loaded at runtime (works with Zod 3 AND 4)
2. Exports version-aware wrappers for APIs whose signatures changed between Zod 3 and 4
3. Validates that pi-agent-core's internal Zod usage is compatible with the app's Zod usage

```typescript
// src/agent/zod-compat.ts

/**
 * Returns the Zod version string, or 'unknown' if undetectable.
 * Works with Zod 3.x and 4.x.
 */
export function getZodVersion(): string {
  // Zod 4: version is in package.json, not on the main export
  // Zod 3: version is at z.z.version
  try {
    const pkg = require('zod/package.json');
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isZod4(): boolean {
  return getZodVersion().startsWith('4.');
}

/**
 * Wrappers for Zod APIs that changed between v3 and v4.
 * Always use these instead of importing zod directly in agent code.
 */
export const zodCompat = {
  object: (shape: any) => z.object(shape),     // shape key order changed in v4
  enum: (values: string[]) => z.enum(values),  // same API, documented for clarity
  // Add wrappers as new incompatibilities are discovered
};
```

## Key Assumptions to Validate

- [ ] `pi-agent-core` does not export its internal Zod instance — if it did, we could compare versions directly
- [ ] Zod 3 and Zod 4 `object()`, `enum()`, `string()` schemas are compatible enough for MVP
- [ ] The primary incompatibility is the `z.version` export change (verified: Zod 4 does not export `.version` on the main module)

## MVP Scope

**In:**
1. Create `src/agent/zod-compat.ts` with `getZodVersion()` that reads from `package.json` as fallback
2. Fix `compatibilityCheck.ts` to use `getZodVersion()` instead of `z.version`
3. Add a `checkPiaiZodCompatibility()` that attempts to import from pi-agent-core and compare Zod versions
4. Update `compatibilityCheck.test.ts` to test both Zod 3 and Zod 4 detection paths
5. Add a `note` field to `CompatibilityResult` listing any known incompatibilities

**Out:**
- Modifying pi-agent-core internals (private package)
- Replacing all `import { z } from 'zod'` with `zodCompat` wrappers across the codebase

## Not Doing (and Why)

- **Full Zod 3→4 migration**: pi-agent-core may still use Zod 3 internally; a full migration could break it. Instead, we coexist with both versions via compatibility detection.
- **Runtime Zod version patching**: Attempting to patch `z.version` at runtime creates fragile code; explicit version detection is cleaner.
- **Automated migration of Zod schemas**: Schema migration between major versions requires case-by-case review.

## Open Questions

1. Should we pin `zod` to a specific minor version in `package.json` to reduce drift? (`"zod": "~4.3.0"`)
2. Does pi-agent-core ever expose its internal Zod version for comparison?
3. Should this compatibility layer live in `src/agent/` or a shared `src/lib/` directory?
