# Maple visit follow-up triage

After a Maple virtual visit, patients ask follow-ups like "Can I take ibuprofen with this?". This demo answers **only when the visit summary supports it**, otherwise escalates to a clinician, and sends emergencies to 911.

## Setup

```bash
npm install
cp .env.local.example .env.local   # set OPEN_AI_API_KEY
```

Node.js 22+. Offline tests use `LLM_PROVIDER=stub` (default).

## Config

| Variable | Default | Notes |
|----------|---------|-------|
| `LLM_PROVIDER` | `stub` | `stub` or `openai` |
| `OPEN_AI_API_KEY` | — | Required when provider is `openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model |
| `GROUNDING_CHECK` | on (`1`) | Set `0` to skip quote+judge checks |
| `GROUNDING_MAX_RETRIES` | `2` | Regenerations after grounding failure (0–3) |
| `PROMPT_VERSION` | `v1` | `v1` or `v2` |
| `LLM_MAX_ATTEMPTS` | `3` | Provider retries on 429/5xx |
| `AGENT_SERVICE_URL` | `http://127.0.0.1:4001` | Web → agent (web package only) |
| `AGENT_TIMEOUT_MS` | `30000` | Web fetch timeout |
| `PORT` / `HOST` | `4001` / `127.0.0.1` | Agent listen address |

## Architecture

```
Browser → apps/web (Next.js) --HTTP JSON--> apps/agent (LangGraph)
apps/eval --imports--> runTriage() in-process
```

- **Key/value store** of visit summaries (`summary_id` → text + `patientId` / `visitDate`). The caller supplies `summaryIds` (trusted for the demo).
- **Graph:** retrieve → (no context) escalate canned reply → else generate → verifyQuotes → LLM judge → retry or escalate → finalize guardrails.
- **Web never holds the OpenAI key** and does not import LangGraph/LangChain.

## Scaling

- Run several agent processes on different ports; point `AGENT_SERVICE_URL` at one of them (or a load balancer later). Responses include `instanceId`.
- Job-queue path (not built): web enqueues `{requestId, question, summaryIds}`, workers call the same `runTriage`, web polls/SSE for the result. The HTTP JSON boundary keeps that a drop-in.

## How to run

```bash
npm test                 # Vitest acceptance suite (stub)
npm run test:e2e         # Playwright UI smoke (starts agent + web)
npm run dev              # agent :4001 + web :3000
npm run ask -- --summary strep_01 "When can I go back to work?"
LLM_PROVIDER=openai PROMPT_VERSION=v1 npm run eval -- --label v1-baseline
LLM_PROVIDER=openai PROMPT_VERSION=v2 npm run eval -- --label v2
npm run eval:compare -- apps/eval/runs/<before>.json apps/eval/runs/<after>.json
```

## Eval results

See [`apps/eval/runs/COMPARISON.md`](apps/eval/runs/COMPARISON.md).

Across three temperature-0 OpenAI runs, **under-triage dropped** (≈0.15 → ≈0.08) while emergency recall stayed at 1.0. Strict accuracy stayed within run-to-run noise. Case_11 is graded strictly (must mention face) and remains a known borderline label.

## Known limits / next steps

- No auth: `summaryIds` are trusted.
- No ranking of visits; all supplied summaries go in the prompt.
- No job queue, streaming, multi-turn chat, or dose calculation.
- Stub LLM echoes Plan + When to seek care (useful for plumbing tests, not clinical quality).
