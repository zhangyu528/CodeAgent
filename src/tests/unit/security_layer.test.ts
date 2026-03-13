import { SecurityLayer } from '../../controller/security_layer';
import * as path from 'path';
import * as fs from 'fs/promises';

export async function test() {
  console.log('=== Running Unit Test: SecurityLayer ===');

  // Redirect global config into workspace to avoid permissions / global state
  const configPath = path.resolve(process.cwd(), 'temp/unit_security_config.json');
  process.env.CODEAGENT_CONFIG_PATH = configPath;

  // Cleanup previous runs
  try { await fs.unlink(configPath); } catch {}

  const workspace = process.cwd();
  const sl = new SecurityLayer(workspace);

  /**
   * Test 1: Path Validation
   */
  console.log('\n[Test 1] Path Validation');
  const safePath = 'src/index.ts';
  const unsafePath = '../../.env';

  if (!sl.validatePath(safePath)) throw new Error('Safe path rejected');
  if (sl.validatePath(unsafePath)) throw new Error('Unsafe path accepted');

  console.log('✅ Path validation works.');

  /**
   * Test 2: Command Blacklist
   */
  console.log('\n[Test 2] Command Sensitivity');
  const safeCmd = 'ls -l';
  const dangerousCmd = 'rm -rf /';
  const customSensitiveCmd = 'npm install package';

  const check1 = sl.checkCommand(safeCmd);
  if (!check1.isSafe) throw new Error('Safe command rejected');

  const check2 = sl.checkCommand(dangerousCmd);
  if (check2.isSafe) throw new Error('Dangerous command accepted as safe');
  console.log(`Detected danger: ${check2.reason}`);

  const check3 = sl.checkCommand(customSensitiveCmd);
  if (!check3.needsApproval) throw new Error('Sensitive command should need approval');

  console.log('✅ Command sensitivity works.');

  /**
   * Test 3: Trust Mode (F6)
   */
  console.log('\n[Test 3] Trust Mode');
  const initialTrust = await sl.isWorkspaceTrusted();
  console.log(`Initial trust status: ${initialTrust}`);

  await sl.grantWorkspaceTrust();
  const afterTrust = await sl.isWorkspaceTrusted();
  if (!afterTrust) throw new Error('Granting trust failed');
  console.log('✅ Trust granted and verified.');

  console.log('\n=== SecurityLayer Unit Test Pass ===');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ SecurityLayer Test Failed:', e.message);
    process.exit(1);
  });
}
