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

## Item 7 — LLM-as-judge faithfulness check

**Requirement:** Fail-closed judge; quote failures short-circuit the judge call.

**RED:** Missing judge module.

**GREEN:** `buildJudgePrompt` / `judgeDraft`; graph `verifyAndJudge` node; grounding-off still passes drafts through.

**Refactor:** Quote failure skips judge (performance).

**Commit:** `Add fail-closed LLM judge so replies cannot add claims beyond the quoted evidence`

## Item 8 — Grounding retry loop

**Requirement:** Retry generation with verbatim feedback; never lower urgency on escalate.

**RED:** Single-pass grounding; generateCalls stayed 1; groundingAttempts not in trace.

**GREEN:** Conditional back-edge to generate while attempts ≤ maxRetries; feedback includes "verbatim" + failed quote; exhausted → escalate keeping draft urgency.

**Refactor:** Shared ungrounded escalation helper.

**Commit:** `Retry generation with grounding feedback before escalating, never lowering urgency`

## Item 9 — Grounding check disabled mode

**Requirement:** GROUNDING_CHECK=0 trusts draft when context exists; still escalates with no context.

**RED:** N/A at write time — behaviour already present from item 7 wiring (`if (!deps.config.groundingCheck)`). Acceptance test still written and run first against current code (passed immediately).

**GREEN:** Confirmed: paraphrased draft returned unchanged; judgeCalls=0; quoteCheckRan=false; empty ids still escalate.

**Refactor:** None.

**Commit:** `Allow disabling real-time grounding to trade safety checks for latency`
