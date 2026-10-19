const ProviderManager = require('./provider-manager');

async function runTests() {
  console.log('--- [Proxy-Lite] Running Self-Tests ---\n');
  const manager = new ProviderManager();

  // Test 1: Load config
  console.log('1. Checking config loading...');
  const providers = manager.getProviders();
  const active = manager.getActiveProvider();
  console.log(`   Found ${providers.length} provider(s).`);
  console.log(`   Active provider: ${active.name} (${active.endpoint})`);
  console.log(`   Default model:   ${active.defaultModel}\n`);

  // Test 2: Test connection to active provider
  console.log(`2. Testing connection to '${active.name}'...`);
  const connTest = await manager.testConnection(active.endpoint, active.apiKey);
  if (!connTest.success) {
    console.error(`   ❌ Connection failed: ${connTest.error}`);
    process.exit(1);
  }
  console.log(`   ✅ Connection OK!`);
  console.log(`   Status code: ${connTest.status}`);
  console.log(`   Latency:     ${connTest.latencyMs}ms`);
  console.log(`   Available models: ${connTest.modelsCount} models found\n`);

  // Test 3: Test chat completion
  console.log(`3. Testing Chat Completion with model '${active.defaultModel}'...`);
  const completionStart = Date.now();
  const res = await manager.chatCompletion({
    model: active.defaultModel,
    messages: [
      { role: 'user', content: 'Katakan "Proxy-Lite siap digunakan!" dalam 1 kalimat pendek.' }
    ],
    maxTokens: 50
  });

  const duration = ((Date.now() - completionStart) / 1000).toFixed(2);
  const reply = res?.choices?.[0]?.message?.content || JSON.stringify(res);
  console.log(`   ✅ Completion received in ${duration}s:`);
  console.log(`   "${reply.trim()}"\n`);

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! 🚀 ---');
}

runTests().catch(err => {
  console.error('\n❌ Test encountered an error:', err);
  process.exit(1);
});
