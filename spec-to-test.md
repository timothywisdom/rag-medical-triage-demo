# Spec → test map

Each row is a requirement from [`specification.md`](specification.md). Links point at the Vitest/Playwright files that prove it. Scenario names match the `it`/`test` titles inside those files.

---

## Core product behaviour

| # | Requirement | Test file(s) | Scenario(s) |
|---|-------------|--------------|-------------|
| C1 | Take a visit summary + patient question and **answer only if the summary supports the answer** | [graph.generate.test.ts](tests/acceptance/graph.generate.test.ts), [grounding.quotes.test.ts](tests/acceptance/grounding.quotes.test.ts), [grounding.judge.test.ts](tests/acceptance/grounding.judge.test.ts) | Happy path with the stub; Quotes found / paraphrased quote fails; Unsupported claim fails the check |
| C2 | **Escalate** when the question can’t be answered safely (new/worsening symptoms, dose changes, anything outside the summary) | [graph.generate.test.ts](tests/acceptance/graph.generate.test.ts), [graph.retrieval.test.ts](tests/acceptance/graph.retrieval.test.ts), [guardrails.test.ts](tests/acceptance/guardrails.test.ts) | Invalid model output → escalate; No summary ids / unknown ids → escalate; Answer with non-routine urgency upgraded to escalate |
| C3 | If the question describes an **emergency**, the reply must tell the patient to contact emergency services | [guardrails.test.ts](tests/acceptance/guardrails.test.ts), [e2e/ask.spec.ts](tests/e2e/ask.spec.ts) | Emergency reply always names emergency services; Graph applies guardrails to an emergency draft; Emergency responses are visually prominent |
| C4 | Output JSON: `action`, `urgency`, `reply`, `evidence`, `reason` | [contract.test.ts](tests/acceptance/contract.test.ts), [agent.service.test.ts](tests/acceptance/agent.service.test.ts), [agent.cli.test.ts](tests/acceptance/agent.cli.test.ts) | Well-formed response validates; Malformed rejected; Valid request returns triage JSON; CLI stdout validates against contract |
| C5 | `evidence` is **quoted lines from the visit summary** | [grounding.quotes.test.ts](tests/acceptance/grounding.quotes.test.ts), [llm.test.ts](tests/acceptance/llm.test.ts) | Quotes found / paraphrased / wrong summary / answer with no evidence; Stub generation evidence quotes |

---

## What to build (assignment deliverables)

| # | Requirement | Test file(s) | Scenario(s) |
|---|-------------|--------------|-------------|
| B1 | The feature itself: **function, CLI, or small service** (no UI required by the assignment) | [agent.service.test.ts](tests/acceptance/agent.service.test.ts), [agent.cli.test.ts](tests/acceptance/agent.cli.test.ts), [graph.retrieval.test.ts](tests/acceptance/graph.retrieval.test.ts) (via `runTriage`) | Valid `/triage` request; Ask from the CLI; Retrieval / no-context paths through the graph |
| B2 | **Eval harness** over cases that reports results | [eval.runner.test.ts](tests/acceptance/eval.runner.test.ts), [eval.score.test.ts](tests/acceptance/eval.score.test.ts) | Run all cases and persist a labelled log; Strict accuracy / summary metrics |
| B3 | Add **≥10 own cases** aimed at likely breakers | [eval.cases.test.ts](tests/acceptance/eval.cases.test.ts) | Case file merges provided and custom cases (≥25 total = 15 provided + 14 custom) |
| B4 | **One improvement iteration** with before-and-after results | [prompts.v2.test.ts](tests/acceptance/prompts.v2.test.ts), [eval.runner.test.ts](tests/acceptance/eval.runner.test.ts) | v2 prompt rules; Compare two runs (plus committed logs in [`apps/eval/runs/COMPARISON.md`](apps/eval/runs/COMPARISON.md)) |

---

## Provided inputs / OpenAI wiring

| # | Requirement | Test file(s) | Scenario(s) |
|---|-------------|--------------|-------------|
| P1 | Use the **5 synthetic visit summaries** from starter data | [store.test.ts](tests/acceptance/store.test.ts) | Fetch by id; Sections parsed (asthma Plan / seek-care); Patient directory |
| P2 | Use the **15 labeled cases** | [eval.cases.test.ts](tests/acceptance/eval.cases.test.ts) | Merged case set includes provided cases; Reply checks for case_07 / case_08 / case_11 / case_14 |
| P3 | OpenAI key via `.env.local` as `OPEN_AI_API_KEY` | [config.test.ts](tests/acceptance/config.test.ts), [live/openai.test.ts](tests/live/openai.test.ts) | OpenAI provider requires a key; Live case_04 smoke (`LIVE=1`) |

---

## Owner decisions (non-functional / design)

| # | Requirement | Test file(s) | Scenario(s) |
|---|-------------|--------------|-------------|
| O1 | **TypeScript + Node.js** workspace | [config.test.ts](tests/acceptance/config.test.ts) (and the whole `tests/acceptance` suite under Vitest) | Defaults / validation prove the shared TS config modules load |
| O2 | **UI** for asking by patient (optional vs assignment, required by owner notes) | [e2e/ask.spec.ts](tests/e2e/ask.spec.ts), [web.route.test.ts](tests/acceptance/web.route.test.ts) | Ask as a patient and see routed response; Question forwarded / patients proxied |
| O3 | Retrieval scoped to the caller’s summaries (**summary ids** trusted for the demo); multi-visit support | [store.test.ts](tests/acceptance/store.test.ts), [graph.retrieval.test.ts](tests/acceptance/graph.retrieval.test.ts), [graph.generate.test.ts](tests/acceptance/graph.generate.test.ts) | Patient `multi_01` newest-first; Retrieval loads every supplied summary; Prompt labels each summary |
| O4 | Store as **key/value** by `summary_id` (not vectors/SQL) | [store.test.ts](tests/acceptance/store.test.ts) | Fetch / missing ids / section parse / patient directory |
| O5 | **Real-time grounding** (verbatim quotes + LLM-as-judge), **on by default**, optional via config | [config.test.ts](tests/acceptance/config.test.ts), [grounding.quotes.test.ts](tests/acceptance/grounding.quotes.test.ts), [grounding.judge.test.ts](tests/acceptance/grounding.judge.test.ts), [graph.retry.test.ts](tests/acceptance/graph.retry.test.ts) | Defaults enable grounding; Quote + judge scenarios; Retry on grounding failure |
| O6 | When grounding is **disabled**, decide from retrieval (+ draft); still escalate if no context | [graph.grounding-off.test.ts](tests/acceptance/graph.grounding-off.test.ts), [config.test.ts](tests/acceptance/config.test.ts) | Disabled check trusts draft; Disabled still escalates with no context; `GROUNDING_CHECK=0` |
| O7 | **No context → always escalate** (no generation call) | [graph.retrieval.test.ts](tests/acceptance/graph.retrieval.test.ts), [graph.grounding-off.test.ts](tests/acceptance/graph.grounding-off.test.ts) | No summary ids; All ids unknown; Disabled check still escalates with no context |
| O8 | Eval is a **separate app** measuring accuracy, with **persisted before/after logs** | [eval.runner.test.ts](tests/acceptance/eval.runner.test.ts), [eval.score.test.ts](tests/acceptance/eval.score.test.ts), [prompts.v2.test.ts](tests/acceptance/prompts.v2.test.ts) | Persist labelled log; Compare two runs; Strict accuracy; v1 still available for baseline |

---

## Supporting / cross-cutting coverage (not a single spec bullet)

| Concern | Test file(s) | Why it exists |
|---------|--------------|---------------|
| Stub vs OpenAI providers + retries | [llm.test.ts](tests/acceptance/llm.test.ts), [live/openai.test.ts](tests/live/openai.test.ts) | Deterministic offline path; live smoke for the real model |
| Web ↔ agent split (no made-up answers on failure) | [web.route.test.ts](tests/acceptance/web.route.test.ts), [config.test.ts](tests/acceptance/config.test.ts) | 502/504 safe messages; web config has no LLM settings |
| Finalize safety (never lower urgency; same-day care) | [guardrails.test.ts](tests/acceptance/guardrails.test.ts) | Implements C2/C3 in code so prompt regressions can’t drop them |

---

## Quick index of all test files

| Path |
|------|
| [tests/acceptance/config.test.ts](tests/acceptance/config.test.ts) |
| [tests/acceptance/store.test.ts](tests/acceptance/store.test.ts) |
| [tests/acceptance/contract.test.ts](tests/acceptance/contract.test.ts) |
| [tests/acceptance/llm.test.ts](tests/acceptance/llm.test.ts) |
| [tests/acceptance/graph.retrieval.test.ts](tests/acceptance/graph.retrieval.test.ts) |
| [tests/acceptance/graph.generate.test.ts](tests/acceptance/graph.generate.test.ts) |
| [tests/acceptance/grounding.quotes.test.ts](tests/acceptance/grounding.quotes.test.ts) |
| [tests/acceptance/grounding.judge.test.ts](tests/acceptance/grounding.judge.test.ts) |
| [tests/acceptance/graph.retry.test.ts](tests/acceptance/graph.retry.test.ts) |
| [tests/acceptance/graph.grounding-off.test.ts](tests/acceptance/graph.grounding-off.test.ts) |
| [tests/acceptance/guardrails.test.ts](tests/acceptance/guardrails.test.ts) |
| [tests/acceptance/agent.service.test.ts](tests/acceptance/agent.service.test.ts) |
| [tests/acceptance/agent.cli.test.ts](tests/acceptance/agent.cli.test.ts) |
| [tests/acceptance/web.route.test.ts](tests/acceptance/web.route.test.ts) |
| [tests/e2e/ask.spec.ts](tests/e2e/ask.spec.ts) |
| [tests/acceptance/eval.cases.test.ts](tests/acceptance/eval.cases.test.ts) |
| [tests/acceptance/eval.score.test.ts](tests/acceptance/eval.score.test.ts) |
| [tests/acceptance/eval.runner.test.ts](tests/acceptance/eval.runner.test.ts) |
| [tests/acceptance/prompts.v2.test.ts](tests/acceptance/prompts.v2.test.ts) |
| [tests/live/openai.test.ts](tests/live/openai.test.ts) |
