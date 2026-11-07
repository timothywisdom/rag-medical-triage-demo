/**
 * Spec: Output JSON — action, urgency, reply, evidence, reason.
 * Feature: Triage response contract
 */
import { describe, expect, it } from "vitest";
import { TriageResponseSchema } from "../../apps/agent/src/contract.js";

describe("Feature: Triage response contract", () => {
  it("Scenario: A well-formed response validates", () => {
    const result = TriageResponseSchema.safeParse({
      action: "answer",
      urgency: "routine",
      reply: "Finish the full 10-day course even if you feel better sooner.",
      evidence: [
        {
          summaryId: "strep_01",
          quote:
            "Finish the full 10-day course even if you feel better sooner.",
        },
      ],
      reason: "Answered from the visit plan.",
    });

    expect(result.success).toBe(true);
  });

  it("Scenario: Malformed model output is rejected", () => {
    const result = TriageResponseSchema.safeParse({
      action: "maybe",
      urgency: "routine",
      reply: "ok",
      evidence: "not-an-array",
      reason: "n/a",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths.some((p) => p === "action" || p.startsWith("action"))).toBe(
        true,
      );
      expect(
        paths.some((p) => p === "evidence" || p.startsWith("evidence")),
      ).toBe(true);
    }
  });
});
