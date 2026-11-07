# Implementation steps log

TDD log for `plan.md`. Updated after each backlog item.

---

## Item 0 — Workspace scaffold and app-level config

**Requirement:** TypeScript/Node workspaces; grounding and LLM provider via validated app-level config (safe offline defaults).

**RED:** Wrote `tests/acceptance/config.test.ts` importing `configFromEnv` / `webConfigFromEnv`. Failure: `Cannot find module '../../apps/agent/src/config.js'`.

**GREEN:** Added npm workspaces (`apps/agent`, `apps/web`, `apps/eval`), root Vitest/tsconfig, agent `configFromEnv` + `loadEnvFile`, web `webConfigFromEnv`. Defaults: stub LLM, grounding on, retries 2, prompt v1, agent `127.0.0.1:4001`, web `AGENT_SERVICE_URL` only.

**Refactor:** None needed (clarity already fine).

**Commit:** `Add workspace scaffold and validated config so every component shares safe offline defaults`
