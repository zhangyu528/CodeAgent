import { SecurityLayer } from '../../controller/security_layer';

async function testSecurityLayerWeb() {
  console.log('=== Running Unit Test: SecurityLayer (Web) ===');

  const sl = new SecurityLayer(process.cwd());

  console.log('\n[Test 1] checkUrl basic allow/deny');
  const ok = sl.checkUrl('https://example.com');
  if (!ok.isSafe || ok.needsApproval) throw new Error('https://example.com should be safe');

  const bad1 = sl.checkUrl('http://127.0.0.1');
  if (bad1.isSafe) throw new Error('127.0.0.1 should be blocked');

  const bad2 = sl.checkUrl('http://192.168.0.1');
  if (bad2.isSafe) throw new Error('192.168.0.1 should be blocked');

  const bad3 = sl.checkUrl('file:///etc/passwd');
  if (bad3.isSafe) throw new Error('file:// should be blocked');

  console.log('✅ checkUrl allow/deny works.');

  console.log('\n[Test 2] checkUrl non-standard port approval');
  const port = sl.checkUrl('https://example.com:8443/docs');
  if (!port.isSafe || !port.needsApproval) throw new Error('Non-standard port should require approval');
  console.log('✅ non-standard port triggers approval.');

  console.log('\n[Test 3] checkWebText sensitivity');
  const t1 = sl.checkWebText('reset my password please');
  if (!t1.needsApproval) throw new Error('password should require approval');

  const t2 = sl.checkWebText('how to use typescript zod');
  if (t2.needsApproval) throw new Error('normal query should not require approval');

  console.log('✅ checkWebText works.');
  console.log('\n=== SecurityLayer (Web) Unit Test Pass ===');
}

testSecurityLayerWeb().catch(e => {
  console.error('❌ SecurityLayer (Web) Test Failed:', e.message);
  process.exit(1);
});
