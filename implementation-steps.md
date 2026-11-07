# Implementation steps log

TDD log for `plan.md`. Updated after each backlog item.

---

## Item 0 — Workspace scaffold and app-level config

**Requirement:** TypeScript/Node workspaces; grounding and LLM provider via validated app-level config (safe offline defaults).

**RED:** Wrote `tests/acceptance/config.test.ts` importing `configFromEnv` / `webConfigFromEnv`. Failure: `Cannot find module '../../apps/agent/src/config.js'`.

**GREEN:** Added npm workspaces (`apps/agent`, `apps/web`, `apps/eval`), root Vitest/tsconfig, agent `configFromEnv` + `loadEnvFile`, web `webConfigFromEnv`. Defaults: stub LLM, grounding on, retries 2, prompt v1, agent `127.0.0.1:4001`, web `AGENT_SERVICE_URL` only.

**Refactor:** None needed (clarity already fine).

**Commit:** `Add workspace scaffold and validated config so every component shares safe offline defaults`

## Item 1 — Visit summary key/value store

**Requirement:** Store visit summaries as a key/value map scoped to caller-supplied ids; support multi-visit patients; parse Plan / When to seek care sections.

**RED:** `tests/acceptance/store.test.ts` failed with `Cannot find module '../../apps/agent/src/store.js'`.

**GREEN:** Added `loadSummaryStore`, `parseSections`, meta sidecar + `extra_summaries.jsonl` for `multi_01` (strep_02/uti_02). `getMany` returns `{ found, missing }` newest-first.

**Refactor:** None.

**Commit:** `Add key/value summary store so retrieval is an O(1) lookup scoped to the caller's ids`

## Item 2 — Response contract

**Requirement:** Shared JSON contract for action, urgency, reply, evidence, reason.

**RED:** Missing `apps/agent/src/contract.js`.

**GREEN:** Zod `TriageResponseSchema` + exported TS types and JSON schema for structured output.

**Refactor:** None.

**Commit:** `Define the triage response contract once so generation, API, and eval agree on shape`

## Item 3 — LLM service: stub and OpenAI providers

**Requirement:** Stub echoes Plan + When to seek care; OpenAI behind one retrying service; LIVE=1 smoke for case_04.

**RED:** Missing `apps/agent/src/llm/stub.js`.

**GREEN:** `StubProvider`, `OpenAIProvider`, `LlmService` with 429/5xx backoff, `createLlm`, opt-in `tests/live/openai.test.ts`.

**Refactor:** None.

**Commit:** `Add stub and OpenAI providers behind one service so tests stay deterministic and the model is swappable`

## Item 4 — Retrieval node and no-context escalation

**Requirement:** Escalate without calling the model when no visit summary is available.

**RED:** Missing `buildTriageGraph` / `runTriage`.

**GREEN:** LangGraph with `retrieve` → `escalateNoContext` (canned reply mentioning 911) or placeholder `awaitGeneration`. Trace records context ids; counting fake confirms generateCalls === 0.

**Refactor:** None.

**Commit:** `Escalate without calling the model when no visit summary is available`

## Item 5 — Generation node (prompt v1)

**Requirement:** Generate drafts from labelled multi-visit context with versioned prompt; invalid model output → escalate.

**RED:** Missing prompts module.

**GREEN:** `prompts/v1.ts` + `buildGenerationPrompt`; graph `generate` node with zod validation fallback.

**Refactor:** None.

**Commit:** `Generate drafts from labelled multi-visit context with a versioned prompt`

## Item 6 — Deterministic verbatim-quote check

**Requirement:** Reject drafts whose evidence is not copied verbatim from the cited summary.

**RED:** Missing `verifyQuotes`.

**GREEN:** Normalised substring match; empty evidence fails for answers, passes for escalations.

**Refactor:** None.

**Commit:** `Reject drafts whose evidence is not copied verbatim from the cited summary`
