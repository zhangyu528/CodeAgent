import { LLMEngine } from '../../llm/engine';
import { registerProvidersFromEnv } from '../../llm/register_providers';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

function restoreEnv(snapshot: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) delete process.env[key];
  }
  for (const [k, v] of Object.entries(snapshot)) {
    if (typeof v === 'undefined') delete process.env[k];
    else process.env[k] = v;
  }
}

async function testRegisterProvidersFromEnv() {
  console.log('=== Running Unit Test: registerProvidersFromEnv ===');

  const snapshot = { ...process.env };
  try {
    // Only configure OpenAI and Ollama fully
    process.env.OPENAI_API_KEY = 'test';
    process.env.OPENAI_MODEL = 'gpt-test';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.OLLAMA_MODEL = 'llama-test';

    // Partially configure DeepSeek to ensure it gets skipped
    process.env.DEEPSEEK_API_KEY = 'test';
    delete process.env.DEEPSEEK_MODEL;

    // Ensure Anthropic has no env at all
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;

    const engine = new LLMEngine();
    const result = registerProvidersFromEnv(engine);

    const providers = engine.listProviders();
    assert(providers.includes('openai'), 'Expected openai registered');
    assert(providers.includes('ollama'), 'Expected ollama registered');
    assert(!providers.includes('deepseek'), 'Expected deepseek NOT registered');
    assert(!providers.includes('anthropic'), 'Expected anthropic NOT registered');

    const skipped = result.skipped.map(s => s.name);
    assert(skipped.includes('deepseek'), 'Expected deepseek in skipped');

    console.log('✅ registerProvidersFromEnv registers only fully-configured providers.');
  } finally {
    restoreEnv(snapshot);
  }
}

testRegisterProvidersFromEnv().catch(e => {
  console.error('❌ registerProvidersFromEnv Test Failed:', e.message);
  process.exit(1);
});
