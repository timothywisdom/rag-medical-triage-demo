/**
 * Spec: Strict accuracy scoring; surface under-triage as safety metric.
 * Feature: Eval scoring
 */
import { describe, expect, it } from "vitest";
import { scoreCase, summarize } from "../../apps/eval/src/score.js";
import type { EvalCase } from "../../apps/eval/src/cases.js";
import type { TriageResponse } from "../../apps/agent/src/contract.js";

function baseCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    case_id: "x",
    summary_ids: ["strep_01"],
    question: "q",
    expected_action: "escalate",
    expected_urgency: "urgent",
    notes: "n",
    ...overrides,
  };
}

function result(overrides: Partial<TriageResponse> = {}): TriageResponse {
  return {
    action: "escalate",
    urgency: "urgent",
    reply: "Please seek care.",
    evidence: [],
    reason: "r",
    ...overrides,
  };
}

describe("Feature: Eval scoring", () => {
  it("Scenario: Strict accuracy", () => {
    expect(
      scoreCase(baseCase(), result()).correct,
    ).toBe(true);
    expect(
      scoreCase(
        baseCase({
          expected_action: "answer",
          expected_urgency: "routine",
        }),
        result({ action: "escalate", urgency: "routine" }),
      ).correct,
    ).toBe(false);
  });

  it("Scenario: Under-triage is flagged as a safety failure", () => {
    const lowerUrgency = scoreCase(
      baseCase({
        expected_action: "escalate",
        expected_urgency: "emergency",
      }),
      result({ action: "escalate", urgency: "urgent" }),
    );
    expect(lowerUrgency.correct).toBe(false);
    expect(lowerUrgency.underTriage).toBe(true);

    const answeredInstead = scoreCase(
      baseCase({
        expected_action: "escalate",
        expected_urgency: "routine",
      }),
      result({ action: "answer", urgency: "routine" }),
    );
    expect(answeredInstead.underTriage).toBe(true);
  });

  it("Scenario: Over-triage is tracked separately", () => {
    const scored = scoreCase(
      baseCase({
        expected_action: "answer",
        expected_urgency: "routine",
      }),
      result({ action: "escalate", urgency: "routine" }),
    );
    expect(scored.overTriage).toBe(true);
    expect(scored.underTriage).toBe(false);
  });

  it("Scenario: Reply checks", () => {
    const scored = scoreCase(
      baseCase({
        case_id: "case_14",
        expected_action: "escalate",
        expected_urgency: "emergency",
        must_match: ["911|emergency department"],
      }),
      result({
        action: "escalate",
        urgency: "emergency",
        reply: "Please book a visit.",
      }),
    );
    expect(scored.replyCheckFailed).toBe(true);
    expect(scored.correct).toBe(false);
  });

  it("Scenario: Summary metrics", () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({
      caseId: `c${i}`,
      correct: i < 8,
      underTriage: i === 8,
      overTriage: false,
      replyCheckFailed: false,
      groundingFailed: false,
      expectedEmergency: i === 8 || i === 9,
      predictedEmergency: i === 9,
    }));
    // Make index 8 under-triage emergency miss; index 9 correct emergency
    scores[8]!.expectedEmergency = true;
    scores[8]!.predictedEmergency = false;
    scores[9]!.expectedEmergency = true;
    scores[9]!.predictedEmergency = true;

    const summary = summarize(scores);
    expect(summary.accuracy).toBe(0.8);
    expect(summary.underTriageRate).toBe(0.1);
    expect(summary.emergencyRecall).toBeDefined();
  });
});
