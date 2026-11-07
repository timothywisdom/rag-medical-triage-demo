# Prompt v1 → v2 comparison

Temperature `0`, model `gpt-4o-mini`, grounding on, 29 cases. Each version ran **3 times**.

## Aggregate metrics

| version | accuracy mean (range) | under-triage mean (range) | emergency recall |
|---------|-----------------------|---------------------------|------------------|
| v1 | 0.644 (0.621–0.655) | 0.149 (0.138–0.172) | 1.00 |
| v2 | 0.632 (0.621–0.655) | 0.080 (0.069–0.103) | 1.00 |

## What changed in v2

- Check every **When to seek care** line before answering and quote the matching rule.
- Map brand ↔ generic only when both appear in the summary.
- Answer from **one visit** and cite only that visit when multiple summaries are present.
- Do not raise urgency above the matching seek-care rule; default to routine unless same-day or 911 applies.

## Interpretation

Strict action+urgency accuracy stayed within run-to-run noise (v2 mean slightly lower). The **safety metric improved**: under-triage roughly halved (0.149 → 0.080) while emergency recall stayed at 1.0. Remaining failures are mostly over-triage on urgency (escalate/urgent vs escalate/routine) and a few still-hard grounding/conflict cases (`c23`, case_11).

Case_11 remains intentionally borderline under strict grading (answer vs escalate).

## Artifacts

- v1 runs: `*-v1-baseline-r{1,2,3}.json`
- v2 runs: `*-v2-r{1,2,3}.json` (after urgency-calibration wording)
- Pairwise flip report: `compare-v1r3-v2r3.md`
