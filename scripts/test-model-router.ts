/**
 * Batch 1 verification: Groq model router selection logic.
 * Uses an injected fake fetcher — no network call, no GROQ_API_KEY
 * needed. This tests the LOGIC (preference matching, fallback,
 * caching), not connectivity to the real Groq API.
 *
 * Usage: npm run test:model-router
 */
import { GroqModelRouter } from '../src/core/ai/groqModelRouter';

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}${pass ? '' : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
  if (!pass) failures++;
}

async function main() {
  // --- Scenario 1: preference matching picks the best available model ---
  let fetchCount = 0;
  const router1 = new GroqModelRouter(async () => {
    fetchCount++;
    return [{ id: 'llama-3.1-8b-instant' }, { id: 'llama-3.3-70b-versatile' }, { id: 'gemma2-9b-it' }];
  });
  const pick1 = await router1.pickModel();
  assertEqual(pick1.modelId, 'llama-3.3-70b-versatile', 'Scenario 1: picks highest-preference available model');
  assertEqual(pick1.matchedPreference, true, 'Scenario 1: reports a preference match');

  // --- Scenario 2: caching avoids refetching within TTL ---
  await router1.pickModel();
  assertEqual(fetchCount, 1, 'Scenario 2: model list is cached, not refetched on second call');

  // --- Scenario 3: the real-world deprecation case (Qwen3.6 -> Qwen3.8) ---
  const router2 = new GroqModelRouter(async () => [
    { id: 'qwen3.8-27b' },
    { id: 'llama-3.1-8b-instant' },
  ]);
  const pick2 = await router2.pickModel();
  assertEqual(pick2.modelId, 'qwen3.8-27b', 'Scenario 3: preference pattern matches new model without a code change');

  // --- Scenario 4: no pattern matches -> falls back to first listed model, not an error ---
  const router3 = new GroqModelRouter(async () => [{ id: 'some-brand-new-model-xyz' }]);
  const pick3 = await router3.pickModel();
  assertEqual(pick3.modelId, 'some-brand-new-model-xyz', 'Scenario 4: falls back to first available model');
  assertEqual(pick3.matchedPreference, false, 'Scenario 4: reports fallback (not a ranked match)');

  // --- Scenario 5: a pinned model wins if available ---
  const router4 = new GroqModelRouter(async () => [{ id: 'llama-3.1-8b-instant' }, { id: 'llama-3.3-70b-versatile' }]);
  const pick4 = await router4.pickModel('llama-3.1-8b-instant');
  assertEqual(pick4.modelId, 'llama-3.1-8b-instant', 'Scenario 5: pinned model overrides preference order when available');

  // --- Scenario 6: empty model list throws rather than silently picking nothing ---
  const router5 = new GroqModelRouter(async () => []);
  try {
    await router5.pickModel();
    console.log('FAIL: Scenario 6: expected an error for an empty model list');
    failures++;
  } catch {
    console.log('PASS: Scenario 6: throws on empty model list');
  }

  if (failures > 0) {
    console.error(`\n${failures} MODEL ROUTER TEST(S) FAILED`);
    process.exit(1);
  }
  console.log('\nALL MODEL ROUTER TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
