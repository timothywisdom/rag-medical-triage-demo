# Maple visit follow-up triage

After a Maple virtual visit, patients ask follow-ups like "Can I take ibuprofen with this?". This demo answers **only when the visit summary supports it**, otherwise escalates to a clinician, and sends emergencies to 911.

## Setup

```bash
npm install
cp .env.local.example .env.local   # edit values; set OPEN_AI_API_KEY for openai
```

Node.js 22+. Agent, CLI, eval, and web load repo-root `.env.local` into `process.env` at boot (existing shell env wins). Defaults and allowed options are documented in [`.env.local.example`](.env.local.example).

## Architecture

```
Browser → apps/web (Next.js) --HTTP JSON--> apps/agent (LangGraph)
apps/eval --imports--> runTriage() in-process
```

- **Key/value store** of visit summaries (`summary_id` → text + `patientId` / `visitDate`). The caller supplies `summaryIds` (trusted for the demo). We assume the production app would have a relational map of user_id to summaryIds. A question would arrive with a JWT indicating the user_id. We'd lookup the summaryIds from this, thus allowing retrieval to fetch only the summaries that belong to the current user. For this demo, the user supplies summaryIds when asking a question.
- **Web never holds the OpenAI key** and does not import LangGraph/LangChain.

### Triage graph (LangGraph)

```mermaid
flowchart TD
  START([START]) --> retrieve[retrieve<br/>load summaries by summaryIds]

  retrieve --> hasCtx{any context?}
  hasCtx -->|no| escalateNoContext[escalateNoContext<br/>canned clinician handoff]
  escalateNoContext --> END1([END])

  hasCtx -->|yes| generate[generate<br/>LLM draft TriageResponse]
  generate --> valid{schema ok?}
  valid -->|fail + retries left| generate
  valid -->|fail + exhausted| END2([END<br/>invalid-model escalate])
  valid -->|yes| verifyAndJudge[verifyAndJudge<br/>verbatim quotes + optional LLM grounding judge]

  verifyAndJudge --> grounded{grounding ok?}
  grounded -->|yes / grounding off| END3([END])
  grounded -->|fail + retries left| generate
  grounded -->|fail + exhausted| escalateUngrounded[escalateUngrounded<br/>clinician handoff]
  escalateUngrounded --> END4([END])

  END1 --> guardrails[applyGuardrails<br/>outside the graph]
  END2 --> guardrails
  END3 --> guardrails
  END4 --> guardrails
  guardrails --> response([TriageResponse])
```

## Scaling

- Run several agent processes on different ports; point `AGENT_SERVICE_URL` at one of them (or a load balancer later). Responses include `instanceId`.
- Job-queue path (not built): web enqueues `{requestId, question, summaryIds}`, workers call the same `runTriage`, web polls/SSE for the result. The HTTP JSON boundary keeps that a drop-in.

## How to run

```bash
npm test                 # Vitest acceptance suite (stub)
npm run test:e2e         # Playwright UI smoke (starts agent + web)
npm run dev              # agent :4001 + web :3000
npm run ask -- --summary strep_01 "When can I go back to work?"
# set LLM_PROVIDER=openai (and key) in .env.local, then:
npm run eval -- --label v2-baseline
PROMPT_VERSION=v3 npm run eval -- --label v3
npm run eval:compare -- apps/eval/runs/<before>.json apps/eval/runs/<after>.json
```

## Eval results

See [`apps/eval/runs/COMPARISON.md`](apps/eval/runs/COMPARISON.md).

Across three temperature-0 OpenAI runs, **under-triage dropped** (≈0.15 → ≈0.08) while emergency recall stayed at 1.0. Strict accuracy stayed within run-to-run noise. Case_11 is graded strictly (must mention face) and remains a known borderline label.

To compare two different eval runs:
`npm run eval:compare -- apps/eval/runs/<before>.json apps/eval/runs/<after>.json`

## Known limits / next steps

- No auth: `summaryIds` are trusted. User names are mapped to summaryIds in [`data/summary_meta.json`](data/summary_meta.json).
- No ranking of visits; all supplied summaries go in the prompt. We would need to rerank summaries to reduce context load if each user has many summaries
- No job queue, streaming, or multi-turn chat.
- Key/Value store is held in memory. Ideally this would be a data store (e.g. Redis)
- Stub LLM echoes Plan + When to seek care (useful for plumbing tests, not clinical quality).

## How this app was built

The application was created using an Agentic Continuous Delivery framework where [`specifictions`](specification.md) are converted into Gherkin scenarios in a [`planning document`](plan.md). An implmentation agent conducts TDD, converting each scenario into a failing acceptance test, then writes the code to make the test pass, then refactors while keep the test green, then commits the change and repeats until all the scenarios are completed. This gives us a path to convert specifications into deterministically executable requirements (aka tests) and increases trust in the AI generated code via passing tests. A mapping of specification to tests is in [`spec-to-test.md`](spec-to-test.md)
