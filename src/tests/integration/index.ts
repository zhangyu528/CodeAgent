import { test as testAgentController } from './agent_controller.test';
import { test as testPlanner } from './planner.test';
import { test as testWebTools } from './web_tools.test';
import { test as testDiffPreviewMiddleware } from './diff_preview_middleware.test';

async function runAllIntegrationTests() {
  console.log('🚀 Starting All Integration Tests...\n');
  const start = Date.now();

  try {
    await testAgentController();
    await testPlanner();
    await testWebTools();
    await testDiffPreviewMiddleware();

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n✨ All Integration Tests Passed! (Duration: ${duration}s)`);
  } catch (err: any) {
    console.error('\n❌ Integration Test Suite Failed:', err.message);
    process.exit(1);
  }
}

runAllIntegrationTests();
