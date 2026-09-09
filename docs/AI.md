# AI — FDS AI Agent

## What exists as of Batch 1

**Nothing here calls a live LLM yet.** Batch 1 builds the foundation
Batch 4 (Customer AI) will plug real reasoning into:

- **Tool architecture** (`src/core/tools/`) — a `Tool` interface and a
  `ToolRegistry`. Two tools are fully real (`get_tenant_info`,
  `list_tenant_users`); `search_products` is real code wired through the
  integration adapter layer but has no adapter to talk to yet, so it
  surfaces an honest 501. Twenty-one more tools from Section 9 of the
  architecture plan are registered as named, discoverable
  `NOT_IMPLEMENTED` stubs — calling any of them returns a 501, never
  fabricated data.
- **Orchestrator** (`src/core/ai/orchestrator.ts`) — dispatches "run
  tool X with input Y" to the registry and logs a `tool.executed` event
  either way. There is no reasoning about *which* tool to call — that
  requires an LLM and a conversation to reason over, which don't exist
  until Batch 4.
- **Groq model router** (`src/core/ai/groqModelRouter.ts`) — the model
  *selection* logic: given a list of available Groq models, picks the
  best match against an ordered, manually-maintained preference-pattern
  list, with graceful fallback when a preferred model disappears (this
  is exactly what happened with Groq's real Qwen3.6-27B → Qwen3.8-27B
  deprecation during this project — see the git history / chat log for
  the concrete incident this was designed against).

## Why the model router doesn't call Groq in tests

Groq's `/models` endpoint returns IDs and context windows, not a
capability score — there's no field saying "this is the best model."
`GroqModelRouter` takes its model-fetching function as a constructor
argument specifically so the *selection logic* (pattern matching,
fallback, caching, pinning) can be verified without a live
`GROQ_API_KEY` or network access in CI. `fetchModelsFromGroq()` in the
same file is the real implementation to pass in once Batch 4 wires up
actual chat completions — it is unused by anything in Batch 1.

## Updating the preference list

`DEFAULT_PREFERENCE_PATTERNS` in `groqModelRouter.ts` is the intended
maintenance point when Groq ships a new model tier. It's a short list of
regex patterns in priority order — no code change needed elsewhere.

## What's still NOT IMPLEMENTED

Actual chat/completion calls to Groq, conversation memory, knowledge
retrieval (RAG), and any agent that decides which tool to call based on
a user's message. These arrive in Batches 2 and 4.
