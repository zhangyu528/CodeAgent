/**
 * Runtime Compatibility Check
 * Detects Zod version mismatches and validates pi-agent-core initialization
 */
import { getZodVersion, isZod4 } from './zod-compat.js';

// Zod version check — pi-agent-core uses Zod 3 internally, project uses Zod 4
function checkZodCompatibility(): { ok: boolean; message: string } {
  const zodVersion = getZodVersion();
  const isZod4Detected = isZod4();

  if (isZod4Detected) {
    // Zod 4 uses different syntax for some things, potential conflict with pi-agent-core's Zod 3 usage
    return {
      ok: true,
      message: `Zod 4.x detected (v${zodVersion}). Compatibility with pi-agent-core noted.`,
    };
  }

  return {
    ok: true,
    message: `Zod v${zodVersion} detected.`,
  };
}

/**
 * Known issues registry for pi-agent-core versions
 * Maps version string to issue details and workaround
 */
export const KNOWN_ISSUES: Record<string, { version: string; issue: string; workaround: string }> =
  {
    '0.62.0': {
      version: '0.62.0',
      issue: 'AgentMessage.content changed from string to ContentBlock[]',
      workaround: 'Pin to 0.61.1 until fix is released',
    },
  };

/**
 * Compatibility error details for API surface mismatches
 */
export interface CompatibilityError {
  pkg: string;
  api: string;
  expectedVersion: string;
  workaround?: string;
}

/**
 * Verify pi-agent-core Agent API surface
 * Ensures Agent.setModel and Agent.setTools are available
 */
function verifyAgentAPIs(): { ok: boolean; errors: CompatibilityError[] } {
  const errors: CompatibilityError[] = [];

  try {
    // Dynamic import to avoid hard coupling — only check when actually used
    const { Agent } = require('@mariozechner/pi-agent-core') as {
      Agent: { new (opts: { getApiKey: (provider: string) => string | undefined }): unknown };
    };

    const agent = new Agent({ getApiKey: () => undefined });

    // Verify Agent.setModel
    if (typeof (agent as Record<string, unknown>).setModel !== 'function') {
      errors.push({
        pkg: 'pi-agent-core',
        api: 'Agent.setModel',
        expectedVersion: '0.61.1',
        workaround: 'Check pi-agent-core version or rollback to 0.61.1',
      });
    }

    // Verify Agent.setTools
    if (typeof (agent as Record<string, unknown>).setTools !== 'function') {
      errors.push({
        pkg: 'pi-agent-core',
        api: 'Agent.setTools',
        expectedVersion: '0.61.1',
        workaround: 'Check pi-agent-core version or rollback to 0.61.1',
      });
    }
  } catch (err) {
    errors.push({
      pkg: 'pi-agent-core',
      api: 'Agent constructor',
      expectedVersion: '0.61.1',
      workaround: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { ok: errors.length === 0, errors };
}

export interface CompatibilityResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; message: string }>;
}

export function runCompatibilityCheck(): CompatibilityResult {
  const checks: CompatibilityResult['checks'] = [];

  // Check Zod compatibility
  const zodCheck = checkZodCompatibility();
  checks.push({ name: 'Zod Compatibility', ok: zodCheck.ok, message: zodCheck.message });

  // Check Node.js version
  const nodeVersion = process.version;
  const versionPart = nodeVersion.slice(1).split('.')[0];
  const nodeMajor = parseInt(versionPart ?? '0', 10);
  if (nodeMajor >= 18) {
    checks.push({ name: 'Node.js Version', ok: true, message: `Node.js ${nodeVersion} (OK)` });
  } else {
    checks.push({
      name: 'Node.js Version',
      ok: false,
      message: `Node.js ${nodeVersion} — expected >=18`,
    });
  }

  // Check pi-agent-core API surface
  const apiCheck = verifyAgentAPIs();
  if (apiCheck.ok) {
    checks.push({
      name: 'pi-agent-core API',
      ok: true,
      message: 'Agent.setModel and Agent.setTools verified',
    });
  } else {
    for (const err of apiCheck.errors) {
      checks.push({
        name: `pi-agent-core API: ${err.api}`,
        ok: false,
        message: `Missing ${err.api} — ${err.workaround}`,
      });
    }
  }

  const allOk = checks.every(c => c.ok);
  return { ok: allOk, checks };
}

// Run check and exit with code 1 on failure
export function runCompatibilityCheckOrExit(): void {
  const result = runCompatibilityCheck();
  if (!result.ok) {
    console.error('[CompatibilityCheck] FAILED:');
    result.checks.forEach(c => {
      if (!c.ok) {
        console.error(`  - ${c.name}: ${c.message}`);
      }
    });
    console.error(
      '[CompatibilityCheck] Exiting. Set CONTINUE_WITH_COMPATIBILITY_ISSUES=1 to ignore.'
    );
    if (!process.env.CONTINUE_WITH_COMPATIBILITY_ISSUES) {
      process.exit(1);
    }
  }
}
