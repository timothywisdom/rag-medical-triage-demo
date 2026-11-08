# Prompt v1 → v2 comparison

Temperature `0`, model `gpt-4o-mini`, grounding on, 29 cases. Each version ran **3 times**.

## Aggregate metrics

| version | accuracy mean (range) | under-triage mean (range) | emergency recall |
|---------|-----------------------|---------------------------|------------------|
| v1 | 0.644 (0.621–0.655) | 0.149 (0.138–0.172) | 1.00 |
| v2 | 0.632 (0.621–0.655) | 0.080 (0.069–0.103) | 1.00 |

## What changed in v2

The only intentional difference between the v1 and v2 eval runs was **`PROMPT_VERSION`** (`v1` → `v2`). Everything else was held constant: model (`gpt-4o-mini`), temperature `0`, grounding on with the same retry budget, and the same 29 cases.

That switches the system prompt from `apps/agent/src/agent/prompts/v1.ts` to `apps/agent/src/agent/prompts/v2.ts`.

**Unchanged from v1:** answer only from the visit summaries; evidence quotes must be verbatim; escalate for new/worsening symptoms, dose changes, missed doses, meds not listed, or anything outside the summaries; emergency → tell the patient to call 911 / go to ED; prefer escalate when unsure.

**Added in v2:**

1. **Seek-care first** — compare the question to every “When to seek care” line before answering; if a rule matches, escalate and quote that rule.
2. **Urgency calibration** — do not raise urgency above what the matching seek-care rule requires; default to `routine` unless the rule says same-day care (`urgent`) or 911/ED (`emergency`).
3. **Brand ↔ generic mapping** — map names like Advil/ibuprofen or Tylenol/acetaminophen only when both appear in the summary.
4. **Single-visit citation** — when multiple visit summaries are present, answer from one visit and cite only that visit’s summary in evidence.
5. **Cross-visit conflict** — escalate when visits disagree (for example a med allowed in one summary but not listed in another).

## Interpretation

Strict action+urgency accuracy stayed within run-to-run noise (v2 mean slightly lower). The **safety metric improved**: under-triage roughly halved (0.149 → 0.080) while emergency recall stayed at 1.0. Remaining failures are mostly over-triage on urgency (escalate/urgent vs escalate/routine) and a few still-hard grounding/conflict cases (`c23`, case_11).

Case_11 remains intentionally borderline under strict grading (answer vs escalate).

## Artifacts

- v1 runs: `*-v1-baseline-r{1,2,3}.json`
- v2 runs: `*-v2-r{1,2,3}.json` (after urgency-calibration wording)
- Pairwise flip report: `compare-v1r3-v2r3.md`
