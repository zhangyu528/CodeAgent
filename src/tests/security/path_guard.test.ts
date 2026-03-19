import { SecurityLayer } from '../../core/controller/security_layer';
import { AgentController } from '../../core/controller/agent_controller';
import { LLMEngine } from '../../core/llm/engine';
import { ReadFileTool } from '../../core/tools/read_file_tool';
import { MockProvider } from '../../core/llm/mock_provider';

async function testPathGuard() {
  console.log('=== Running Security Test: Path Guard (E2E, MockProvider) ===');

  const engine = new LLMEngine();
  engine.registerProvider(new MockProvider());

  const tools = [new ReadFileTool()];
  const security = new SecurityLayer(process.cwd());
  const controller = new AgentController(engine, tools, 'mock', security);

  const badPath = '../../.env';
  console.log(`[Task]: Attempt to read '${badPath}'`);

  const { content: result } = await controller.run(`Read the file '${badPath}'`);

  const blocked =
    result.toLowerCase().includes('security') ||
    result.toLowerCase().includes('workspace') ||
    result.toLowerCase().includes('outside');

  if (blocked) {
    console.log('\x1b[32m%s\x1b[0m', '✅ SUCCESS: Security Layer blocked the access.');
  } else {
    console.error('\x1b[31m%s\x1b[0m', '❌ FAILURE: Security Layer failed to block access!');
    console.log('Response was:', result);
    process.exit(1);
  }
}

testPathGuard().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
