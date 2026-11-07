/**
 * Spec: LLM-as-a-judge faithfulness check (fail-closed).
 * Feature: Reply faithfulness judge
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import {
  buildTriageGraph,
  runTriage,
} from "../../apps/agent/src/agent/graph.js";
import {
  buildJudgePrompt,
  judgeDraft,
} from "../../apps/agent/src/agent/grounding/judge.js";
import type { LlmProvider } from "../../apps/agent/src/llm/types.js";
import type { TriageResponse } from "../../apps/agent/src/contract.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

const groundedDraft: TriageResponse = {
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
  reason: "from plan",
};

describe("Feature: Reply faithfulness judge", () => {
  it("Scenario: Judge receives only the evidence and reply", () => {
    const prompt = buildJudgePrompt(
      "Can I stop early?",
      groundedDraft,
    );
    expect(prompt).toContain("Can I stop early?");
    expect(prompt).toContain(groundedDraft.evidence[0]!.quote);
    expect(prompt).toContain(groundedDraft.reply);
    expect(prompt).toMatch(/supported by the evidence/i);
    expect(prompt).toMatch(/"supported"/);
    expect(prompt).toMatch(/unsupported_claims/);
  });

  it("Scenario: Unsupported claim fails the check", async () => {
    const store = loadSummaryStore(dataDir);
    let judgeCalls = 0;
    const llm: LlmProvider = {
      async generate() {
        return groundedDraft;
      },
      async judge() {
        judgeCalls += 1;
        return {
          supported: false,
          unsupportedClaims: ["take ibuprofen"],
        };
      },
    };
    const config = configFromEnv({});
    const graph = buildTriageGraph({ store, llm, config });
    const result = await runTriage(
      { question: "q", summaryIds: ["strep_01"] },
      { graph },
    );

    // Without retry loop yet, a failed judge should leave a fail verdict in trace
    // or escalate. Item 7 wires judge; item 8 adds retries.
    expect(judgeCalls).toBeGreaterThan(0);
    expect(
      result.trace.groundingFailures.some((f) => /ibuprofen/i.test(f)) ||
        result.response.action === "escalate",
    ).toBe(true);
  });

  it("Scenario: Unparseable judge output is treated as a failure", async () => {
    const store = loadSummaryStore(dataDir);
    const llm: LlmProvider = {
      async generate() {
        return groundedDraft;
      },
      async judge() {
        throw new Error("sure looks fine");
      },
    };
    const verdict = await judgeDraft(llm, groundedDraft, "q", [
      store.get("strep_01")!,
    ]);
    expect(verdict.supported).toBe(false);
  });

  it("Quote failure short-circuits the judge call", async () => {
    const store = loadSummaryStore(dataDir);
    let judgeCalls = 0;
    const llm: LlmProvider = {
      async generate() {
        return {
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
      },
      async judge() {
        judgeCalls += 1;
        return { supported: true, unsupportedClaims: [] };
      },
    };
    const config = configFromEnv({});
    const graph = buildTriageGraph({ store, llm, config });
    await runTriage(
      { question: "Can I stop?", summaryIds: ["strep_01"] },
      { graph },
    );
    expect(judgeCalls).toBe(0);
  });
});
