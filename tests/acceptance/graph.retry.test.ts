/**
 * Spec: Retry generation with strengthened verbatim feedback before escalating.
 * Feature: Regenerate on grounding failure
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import {
  buildTriageGraph,
  runTriage,
} from "../../apps/agent/src/agent/graph.js";
import type { LlmProvider, GenerateInput } from "../../apps/agent/src/llm/types.js";
import type { TriageResponse } from "../../apps/agent/src/contract.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

const paraphrase: TriageResponse = {
  action: "answer",
  urgency: "routine",
  reply: "Finish all ten days of antibiotics",
  evidence: [
    {
      summaryId: "strep_01",
      quote: "Finish all ten days of antibiotics",
    },
  ],
  reason: "paraphrase",
};

const verbatim: TriageResponse = {
  action: "answer",
  urgency: "routine",
  reply:
    "Finish the full 10-day course even if you feel better sooner.",
  evidence: [
    {
      summaryId: "strep_01",
      quote:
        "Finish the full 10-day course even if you feel better sooner.",
    },
  ],
  reason: "verbatim",
};

describe("Feature: Regenerate on grounding failure", () => {
  it("Scenario: Second attempt succeeds", async () => {
    const store = loadSummaryStore(dataDir);
    const calls: GenerateInput[] = [];
    let n = 0;
    const llm: LlmProvider = {
      async generate(input) {
        calls.push(input);
        n += 1;
        return n === 1 ? paraphrase : verbatim;
      },
      async judge() {
        return { supported: true, unsupportedClaims: [] };
      },
    };
    const config = configFromEnv({ GROUNDING_MAX_RETRIES: "2" });
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      {
        question: "Can I stop the antibiotic early?",
        summaryIds: ["strep_01"],
      },
      { graph },
    );

    expect(result.response.action).toBe("answer");
    expect(calls).toHaveLength(2);
    expect(calls[1]!.feedback ?? "").toMatch(/verbatim/i);
    expect(calls[1]!.feedback ?? "").toMatch(/Finish all ten days/i);
  });

  it("Scenario: Retries exhausted escalates without lowering urgency", async () => {
    const store = loadSummaryStore(dataDir);
    let generateCalls = 0;
    const urgentParaphrase: TriageResponse = {
      ...paraphrase,
      urgency: "urgent",
    };
    const llm: LlmProvider = {
      async generate() {
        generateCalls += 1;
        return urgentParaphrase;
      },
      async judge() {
        return { supported: true, unsupportedClaims: [] };
      },
    };
    const config = configFromEnv({ GROUNDING_MAX_RETRIES: "2" });
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "anything", summaryIds: ["strep_01"] },
      { graph },
    );

    expect(generateCalls).toBe(3);
    expect(result.response.action).toBe("escalate");
    expect(result.response.urgency).toBe("urgent");
    expect(result.response.reason).toMatch(/grounding/i);
  });

  it("Scenario: Retry count is recorded for observability", async () => {
    const store = loadSummaryStore(dataDir);
    const llm: LlmProvider = {
      async generate() {
        return paraphrase;
      },
      async judge() {
        return { supported: true, unsupportedClaims: [] };
      },
    };
    const config = configFromEnv({ GROUNDING_MAX_RETRIES: "1" });
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "q", summaryIds: ["strep_01"] },
      { graph },
    );

    expect(result.trace.groundingAttempts).toBeGreaterThan(0);
    expect(result.trace.groundingFailures.length).toBeGreaterThan(0);
  });
});
