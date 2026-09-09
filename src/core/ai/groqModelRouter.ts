/**
 * AI orchestration foundation — model routing (Section 32 of the
 * architecture plan). Groq's /models endpoint returns IDs and context
 * windows but no quality/capability score, so "auto-detect the best
 * model" is implemented honestly as: match against an ordered,
 * manually-maintained preference-pattern list, and fall back gracefully
 * when a preferred model disappears (as literally happened with the
 * Qwen3.6-27B -> Qwen3.8-27B deprecation during this project).
 *
 * No live network call happens in this file's tests — `fetchModels` is
 * injected so the selection LOGIC can be verified without needing a
 * GROQ_API_KEY in CI. The real fetcher (fetchModelsFromGroq below) is
 * what production code should pass in.
 */

export interface GroqModel {
  id: string;
  context_window?: number;
}

export type ModelFetcher = () => Promise<GroqModel[]>;

// Ordered most- to least-preferred. Update this list when Groq ships a
// genuinely new tier — that's the intended maintenance point, not a
// code change to the selection logic itself.
export const DEFAULT_PREFERENCE_PATTERNS: RegExp[] = [
  /^llama-3\.3-70b/i,
  /^llama-3\.1-70b/i,
  /^qwen3(\.\d+)?-\d{2,3}b/i,     // qwen3.x with any double/triple-digit param count (e.g. 27b, 72b)
  /^mixtral-8x7b/i,
  /^llama-3\.1-8b/i,
  /^gemma2-9b/i,
];

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function fetchModelsFromGroq(apiKey: string): Promise<GroqModel[]> {
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Groq /models request failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { data: GroqModel[] };
  return body.data;
}

export class GroqModelRouter {
  private cachedModels: GroqModel[] | null = null;
  private cachedAt = 0;

  constructor(
    private fetchModels: ModelFetcher,
    private preferencePatterns: RegExp[] = DEFAULT_PREFERENCE_PATTERNS,
    private cacheTtlMs: number = DEFAULT_CACHE_TTL_MS,
    private now: () => number = () => Date.now()
  ) {}

  async getAvailableModels(): Promise<GroqModel[]> {
    const isStale = this.now() - this.cachedAt > this.cacheTtlMs;
    if (!this.cachedModels || isStale) {
      this.cachedModels = await this.fetchModels();
      this.cachedAt = this.now();
    }
    return this.cachedModels;
  }

  /**
   * Picks a model. If `pinnedModelId` is given (e.g. a Pro-tier tenant's
   * fixed choice) and it's currently available, that wins outright.
   * Otherwise, the first available model matching the preference list
   * (in order) is chosen. If nothing matches any pattern, falls back to
   * whatever model the API listed first, rather than failing outright —
   * logged by the caller as a "using unranked fallback" situation.
   */
  async pickModel(pinnedModelId?: string): Promise<{ modelId: string; matchedPreference: boolean }> {
    const models = await this.getAvailableModels();
    if (models.length === 0) {
      throw new Error('No models available from Groq');
    }

    if (pinnedModelId && models.some((m) => m.id === pinnedModelId)) {
      return { modelId: pinnedModelId, matchedPreference: true };
    }

    for (const pattern of this.preferencePatterns) {
      const match = models.find((m) => pattern.test(m.id));
      if (match) {
        return { modelId: match.id, matchedPreference: true };
      }
    }

    return { modelId: models[0].id, matchedPreference: false };
  }
}
