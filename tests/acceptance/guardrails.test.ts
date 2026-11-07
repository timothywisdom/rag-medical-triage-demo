/**
 * Spec: Emergency replies must name emergency services; err toward escalate.
 * Feature: Safety guardrails
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import {
  buildTriageGraph,
  runTriage,
} from "../../apps/agent/src/agent/graph.js";
import { applyGuardrails } from "../../apps/agent/src/agent/guardrails.js";
import type { TriageResponse } from "../../apps/agent/src/contract.js";
import type { LlmProvider } from "../../apps/agent/src/llm/types.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

const urgencyRank = { routine: 0, urgent: 1, emergency: 2 } as const;

describe("Feature: Safety guardrails", () => {
  it("Scenario: Emergency reply always names emergency services", () => {
    const draft: TriageResponse = {
      action: "answer",
      urgency: "emergency",
      reply: "please book a visit",
      evidence: [],
      reason: "red flag",
    };
    const out = applyGuardrails(draft);
    expect(out.action).toBe("escalate");
    expect(out.reply).toMatch(
      /call 911 or go to the nearest emergency department/i,
    );
  });

  it("Scenario: Answer with non-routine urgency is upgraded to escalate", () => {
    const draft: TriageResponse = {
      action: "answer",
      urgency: "urgent",
      reply: "You may have a kidney infection.",
      evidence: [],
      reason: "fever + flank pain",
    };
    const out = applyGuardrails(draft);
    expect(out.action).toBe("escalate");
    expect(out.urgency).toBe("urgent");
  });

  it("Scenario: Urgent escalation tells the patient to get same-day care", () => {
    const draft: TriageResponse = {
      action: "escalate",
      urgency: "urgent",
      reply: "Please contact a clinician.",
      evidence: [],
      reason: "worsening",
    };
    const out = applyGuardrails(draft);
    expect(out.reply).toMatch(/same day/i);
  });

  it("Scenario: Guardrails never lower urgency", () => {
    const actions: TriageResponse["action"][] = ["answer", "escalate"];
    const urgencies: TriageResponse["urgency"][] = [
      "routine",
      "urgent",
      "emergency",
    ];
    for (const action of actions) {
      for (const urgency of urgencies) {
        const draft: TriageResponse = {
          action,
          urgency,
          reply: "placeholder",
          evidence: [],
          reason: "test",
        };
        const out = applyGuardrails(draft);
        expect(urgencyRank[out.urgency]).toBeGreaterThanOrEqual(
          urgencyRank[urgency],
        );
      }
    }
  });

  it("Graph applies guardrails to an emergency draft", async () => {
    const store = loadSummaryStore(dataDir);
    const llm: LlmProvider = {
      async generate() {
        return {
          action: "answer",
          urgency: "emergency",
          reply: "please book a visit",
          evidence: [
            {
              summaryId: "asthma_01",
              quote:
                "The blue puffer is not helping, you cannot speak in full sentences, or your lips or fingernails look blue or grey: call 911 or go to the nearest emergency department.",
            },
          ],
          reason: "911 rule",
        };
      },
      async judge() {
        return { supported: true, unsupportedClaims: [] };
      },
    };
    const config = configFromEnv({ GROUNDING_CHECK: "0" });
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      {
        question: "My inhaler isn't helping and I can't finish a sentence",
        summaryIds: ["asthma_01"],
      },
      { graph },
    );
    expect(result.response.action).toBe("escalate");
    expect(result.response.reply).toMatch(/911/);
  });
});
