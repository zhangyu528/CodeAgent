import { SecurityLayer } from '../../controller/security_layer';

async function testSecurityLayer() {
  console.log('=== Running Unit Test: SecurityLayer ===');

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
  // Initially should not be trusted in a test environment (unless previously run)
  const initialTrust = await sl.isWorkspaceTrusted();
  console.log(`Initial trust status: ${initialTrust}`);

  await sl.grantWorkspaceTrust();
  const afterTrust = await sl.isWorkspaceTrusted();
  if (!afterTrust) throw new Error('Granting trust failed');
  console.log('✅ Trust granted and verified.');

  // Cleanup: optional, but good practice for unit tests to not leave global state
  // However, since it's in ~/.codeagent, we might leave it or use a mock.
  // For raw unit test, we just verify the flow.

  console.log('\n=== SecurityLayer Unit Test Pass ===');
}

testSecurityLayer().catch(e => {
  console.error('❌ SecurityLayer Test Failed:', e.message);
  process.exit(1);
});
