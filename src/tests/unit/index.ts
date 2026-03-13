import { test as testContextInformer } from './context_informer.test';
import { test as testMemoryManager } from './memory_manager.test';
import { test as testSecurityLayer } from './security_layer.test';
import { test as testSecurityLayerWeb } from './security_layer_web.test';
import { test as testTelemetryMonitor } from './telemetry_monitor.test';
import { test as testRegisterProviders } from './register_providers.test';
import { test as testDiffRenderer } from './diff_renderer.test';
import { test as testToolBubbles } from './tool_bubbles.test';
import { test as testReadlineCompleter } from './readline_completer.test';
import { test as testUserTools } from './user_tools.test';
import { test as testSlashCommands } from './slash_commands.test';
import { test as testSetupWizard } from './setup_wizard.test';
import { test as testWelcomeBanner } from './welcome_banner.test';

async function runAllUnitTests() {
  console.log('🚀 Starting All Unit Tests...\n');
  const start = Date.now();

  try {
    await testContextInformer();
    await testMemoryManager();
    await testSecurityLayer();
    await testSecurityLayerWeb();
    await testTelemetryMonitor();
    await testRegisterProviders();
    await testDiffRenderer();
    await testToolBubbles();
    await testReadlineCompleter();
    await testUserTools();
    await testSlashCommands();
    await testSetupWizard();
    await testWelcomeBanner();

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n✨ All Unit Tests Passed! (Duration: ${duration}s)`);
  } catch (err: any) {
    console.error('\n❌ Unit Test Suite Failed:', err.message);
    process.exit(1);
  }
}

runAllUnitTests();
