# pi-agent-core API Contract & Version Guard

## Problem Statement

CodeAgent depends on `@mariozechner/pi-agent-core` (`^0.61.1`) and `@mariozechner/pi-ai` (`^0.61.1`) but has no version pinning or API contract enforcement. Recent commit 14517cb added a runtime compatibility check that verifies Zod and pi-agent-core versions match at startup, but:

1. The check runs _after_ the code is already running — if `pi-agent-core` ships a breaking API change in a minor/patch version, runtime errors occur
2. The dependency `^0.61.1` allows `0.62.0`, `0.70.0` etc. — any minor version upgrade could introduce breaking changes
3. No `API compatibility layer` exists: if `pi-agent-core` changes its exports (e.g., `AgentMessage` shape, `Agent` constructor options), every consumer must immediately update
4. The `compatibilityCheck.ts` file (added in 14517cb) is the only safeguard — but it's a reactive check, not a proactive contract

This is the root cause of the N3 "in progress" state: the team cannot confidently ship N3/N4/N5 because any upstream change to `pi-agent-core` could silently break behavior.

## Recommended Direction

**Strict Dependency Pinning + Runtime API Contract Verification**

### 1. Strict Version Pinning

Move from `^0.61.1` to `0.61.1` in `package.json`. Only upgrade manually after:

- Reviewing `pi-agent-core` changelog
- Running full test suite
- Updating `compatibilityCheck.ts` for new API surface

```json
// package.json — pin exact version
"@mariozechner/pi-agent-core": "0.61.1",
"@mariozechner/pi-ai": "0.61.1",
```

### 2. API Contract Test Suite

Add a test that explicitly verifies the `pi-agent-core` API surface:

```typescript
// tests/unit/agent/piAgentCoreContract.test.ts
import { Agent } from '@mariozechner/pi-agent-core';
import { AgentMessage } from '@mariozechner/pi-agent-core';

// Contract: These exports must exist and have expected shapes
test('pi-agent-core exports AgentMessage interface', () => {
  const msg: AgentMessage = { role: 'user', content: 'test' };
  expect(msg.role).toBe('user');
});

test('Agent constructor accepts getApiKey function', () => {
  const agent = new Agent({ getApiKey: (p: string) => process.env[p] });
  expect(agent).toBeDefined();
});

test('Agent.setTools accepts array', () => {
  const agent = new Agent({ getApiKey: () => null });
  agent.setTools([] as any);
});

// Expand to cover all public APIs used by CodeAgent
```

### 3. Enhanced Runtime Compatibility Check

Extend `compatibilityCheck.ts` to verify not just version numbers but actual API availability:

```typescript
// compatibilityCheck.ts — enhanced
export function runCompatibilityCheck(): void {
  // Existing: version check
  checkMinVersion('pi-agent-core', '0.61.1');

  // New: API surface check
  const agent = new Agent({ getApiKey: () => undefined });

  if (typeof agent.setModel !== 'function') {
    throw new CompatibilityError('pi-agent-core', 'Agent.setModel', '0.61.1');
  }
  if (typeof agent.setTools !== 'function') {
    throw new CompatibilityError('pi-agent-core', 'Agent.setTools', '0.61.1');
  }
}
```

### 4. Deprecation Warning System

Add a `DEPRECATION_NOTICE` field to `compatibilityCheck.ts` that flags when `pi-agent-core` is approaching end-of-life or known issues:

```typescript
const KNOWN_ISSUES: Record<string, { version: string; issue: string; workaround: string }> = {
  '0.62.0': {
    version: '0.62.0',
    issue: 'AgentMessage.content changed from string to ContentBlock[]',
    workaround: 'Pin to 0.61.1 until fix is released',
  },
};
```

## Key Assumptions to Validate

- [ ] `pi-agent-core` follows semver strictly (minor/patch don't break API)
- [ ] `pi-agent-core` changelog is publicly accessible for review before upgrades
- [ ] The current `0.61.1` behavior is stable and not subject to urgent patches
- [ ] `Agent.setModel` and `Agent.setTools` are the only public APIs consumed (if new APIs are used, add to contract test)

## MVP Scope

**In:**

1. Pin `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai` to exact version `0.61.1` in `package.json`
2. Add `tests/unit/agent/piAgentCoreContract.test.ts` covering all `pi-agent-core` APIs actually used
3. Enhance `compatibilityCheck.ts` with API surface checks (not just version)
4. Add `KNOWN_ISSUES` registry with at least the current compatibility note

**Out:**

- Own fork of `pi-agent-core` (out of scope; use upstream)
- Automated changelog scraping (future CI enhancement)
- Broad semver range testing across multiple versions

## Not Doing (and Why)

- **Pinning in `package-lock.json`** alone is insufficient because `npm install` with `--frozen-lockfile` is not enforced in all environments (dev machines, CI may differ)
- **Forking pi-agent-core**: would require maintaining a separate repo with merge overhead; not justified without evidence that upstream is unreliable
- **Version bump automation**: adds CI complexity; manual review is safer for a critical dependency

## Open Questions

1. Should we add `pi-agent-core` to `devDependencies` or keep it in `dependencies`? (Currently in `dependencies`, meaning it's a runtime dep)
2. Is there a private npm registry we can mirror `pi-agent-core` on, ensuring the package is always available even if the original disappears?
3. Who owns reviewing `pi-agent-core` changelogs before version upgrades? Should this be a PR checklist item?
4. Should the contract test be run in CI, or only locally on developer machines?
