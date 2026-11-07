/**
 * Spec: When grounding disabled, decide from retrieval context only.
 * Feature: Grounding check can be turned off
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import {
  buildTriageGraph,
  runTriage,
} from "../../apps/agent/src/agent/graph.js";
import type { LlmProvider } from "../../apps/agent/src/llm/types.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Grounding check can be turned off", () => {
  it("Scenario: Disabled check trusts the draft when context exists", async () => {
    const store = loadSummaryStore(dataDir);
    let judgeCalls = 0;
    const paraphrase = {
      action: "answer" as const,
      urgency: "routine" as const,
      reply: "Finish all ten days of antibiotics",
      evidence: [
        {
          summaryId: "strep_01",
          quote: "Finish all ten days of antibiotics",
        },
      ],
      reason: "paraphrase",
    };
    const llm: LlmProvider = {
      async generate() {
        return paraphrase;
      },
      async judge() {
        judgeCalls += 1;
        return { supported: false, unsupportedClaims: ["x"] };
      },
    };
    const config = configFromEnv({ GROUNDING_CHECK: "0" });
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "Can I stop?", summaryIds: ["strep_01"] },
      { graph },
    );

    expect(result.response).toEqual(paraphrase);
    expect(judgeCalls).toBe(0);
    expect(result.trace.quoteCheckRan).toBe(false);
  });

  it("Scenario: Disabled check still escalates with no context", async () => {
    const store = loadSummaryStore(dataDir);
    const llm: LlmProvider = {
      async generate() {
        throw new Error("should not generate");
      },
      async judge() {
        throw new Error("should not judge");
      },
    };
    const config = configFromEnv({ GROUNDING_CHECK: "0" });
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "anything", summaryIds: [] },
      { graph },
    );

    expect(result.response.action).toBe("escalate");
  });
});
