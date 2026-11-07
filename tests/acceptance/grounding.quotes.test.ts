/**
 * Spec: Grounding — evidence quotes must be verbatim from the cited summary.
 * Feature: Evidence quotes are verbatim
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { verifyQuotes } from "../../apps/agent/src/agent/grounding/quotes.js";
import type { TriageResponse } from "../../apps/agent/src/contract.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Evidence quotes are verbatim", () => {
  it("Scenario: Quotes found in the cited summary pass", () => {
    const store = loadSummaryStore(dataDir);
    const strep = store.get("strep_01")!;
    const draft: TriageResponse = {
      action: "answer",
      urgency: "routine",
      reply: "Finish the course.",
      evidence: [
        {
          summaryId: "strep_01",
          quote:
            "Finish the full 10-day course even if you feel better sooner.",
        },
      ],
      reason: "from plan",
    };
    const result = verifyQuotes(draft, [strep]);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("Scenario: Paraphrased quote fails", () => {
    const store = loadSummaryStore(dataDir);
    const strep = store.get("strep_01")!;
    const draft: TriageResponse = {
      action: "answer",
      urgency: "routine",
      reply: "Finish antibiotics.",
      evidence: [
        {
          summaryId: "strep_01",
          quote: "Finish all ten days of antibiotics",
        },
      ],
      reason: "paraphrase",
    };
    const result = verifyQuotes(draft, [strep]);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /Finish all ten days/i.test(f))).toBe(
      true,
    );
  });

  it("Scenario: Quote attributed to the wrong summary fails", () => {
    const store = loadSummaryStore(dataDir);
    const { found } = store.getMany(["strep_02", "uti_02"]);
    const utiLine =
      "Nitrofurantoin can turn urine dark yellow or brown. This is a harmless side effect.";
    const draft: TriageResponse = {
      action: "answer",
      urgency: "routine",
      reply: utiLine,
      evidence: [{ summaryId: "strep_02", quote: utiLine }],
      reason: "wrong cite",
    };
    const result = verifyQuotes(draft, found);
    expect(result.passed).toBe(false);
  });

  it("Scenario: An answer with no evidence fails", () => {
    const store = loadSummaryStore(dataDir);
    const draft: TriageResponse = {
      action: "answer",
      urgency: "routine",
      reply: "You can stop early.",
      evidence: [],
      reason: "ungrounded",
    };
    const result = verifyQuotes(draft, [store.get("strep_01")!]);
    expect(result.passed).toBe(false);
  });

  it("Escalations with empty evidence pass", () => {
    const store = loadSummaryStore(dataDir);
    const draft: TriageResponse = {
      action: "escalate",
      urgency: "routine",
      reply: "Please speak with a clinician.",
      evidence: [],
      reason: "outside summary",
    };
    expect(verifyQuotes(draft, [store.get("strep_01")!]).passed).toBe(true);
  });
});
