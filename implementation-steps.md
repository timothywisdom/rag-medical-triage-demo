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
