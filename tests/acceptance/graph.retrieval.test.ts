/**
 * Spec: No context found → escalate to clinician without calling the model.
 * Feature: Retrieval scoped to the caller's summaries
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { TriageResponseSchema } from "../../apps/agent/src/contract.js";
import {
  buildTriageGraph,
  runTriage,
} from "../../apps/agent/src/agent/graph.js";
import type { LlmProvider } from "../../apps/agent/src/llm/types.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

function countingFake(): LlmProvider & { generateCalls: number } {
  const fake = {
    generateCalls: 0,
    async generate() {
      fake.generateCalls += 1;
      return {
        action: "answer" as const,
        urgency: "routine" as const,
        reply: "should not run",
        evidence: [],
        reason: "fake",
      };
    },
    async judge() {
      return { supported: true, unsupportedClaims: [] };
    },
  };
  return fake;
}

describe("Feature: Retrieval scoped to the caller's summaries", () => {
  it("Scenario: Retrieval loads every supplied summary", async () => {
    const store = loadSummaryStore(dataDir);
    const llm = countingFake();
    const config = configFromEnv({});
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "q", summaryIds: ["strep_02", "uti_02"] },
      { graph },
    );

    expect(result.trace.contextSummaryIds).toEqual(["strep_02", "uti_02"]);
  });

  it("Scenario: No summary ids supplied", async () => {
    const store = loadSummaryStore(dataDir);
    const llm = countingFake();
    const config = configFromEnv({});
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "Can I stop the antibiotic?", summaryIds: [] },
      { graph },
    );

    const parsed = TriageResponseSchema.safeParse(result.response);
    expect(parsed.success).toBe(true);
    expect(result.response.action).toBe("escalate");
    expect(result.response.urgency).toBe("routine");
    expect(result.response.evidence).toEqual([]);
    expect(result.response.reason).toMatch(/no visit summary/i);
    expect(result.response.reply).toMatch(/911/);
    expect(llm.generateCalls).toBe(0);
  });

  it("Scenario: All supplied ids are unknown", async () => {
    const store = loadSummaryStore(dataDir);
    const llm = countingFake();
    const config = configFromEnv({});
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "anything", summaryIds: ["nope_99"] },
      { graph },
    );

    expect(result.response.action).toBe("escalate");
    expect(llm.generateCalls).toBe(0);
  });
});
