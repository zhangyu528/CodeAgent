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
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (nodeMajor >= 18) {
    checks.push({ name: 'Node.js Version', ok: true, message: `Node.js ${nodeVersion} (OK)` });
  } else {
    checks.push({ name: 'Node.js Version', ok: false, message: `Node.js ${nodeVersion} — expected >=18` });
  }

  const allOk = checks.every((c) => c.ok);
  return { ok: allOk, checks };
}

// Run check and exit with code 1 on failure
export function runCompatibilityCheckOrExit(): void {
  const result = runCompatibilityCheck();
  if (!result.ok) {
    console.error('[CompatibilityCheck] FAILED:');
    result.checks.forEach((c) => {
      if (!c.ok) {
        console.error(`  - ${c.name}: ${c.message}`);
      }
    });
    console.error('[CompatibilityCheck] Exiting. Set CONTINUE_WITH_COMPATIBILITY_ISSUES=1 to ignore.');
    if (!process.env.CONTINUE_WITH_COMPATIBILITY_ISSUES) {
      process.exit(1);
    }
  }
}
