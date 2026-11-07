/**
 * Spec: Stub LLM echoes Plan and When to seek care; OpenAI behind one service.
 * Feature: LLM providers
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadSummaryStore, parseSections } from "../../apps/agent/src/store.js";
import { StubProvider } from "../../apps/agent/src/llm/stub.js";
import { LlmService } from "../../apps/agent/src/llm/service.js";
import type { LlmProvider, GenerateInput } from "../../apps/agent/src/llm/types.js";
import type { TriageResponse } from "../../apps/agent/src/contract.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: LLM providers", () => {
  it("Scenario: Stub generation echoes the plan and seek-care sections", async () => {
    const store = loadSummaryStore(dataDir);
    const strep = store.get("strep_01")!;
    const sections = parseSections(strep.text);
    const stub = new StubProvider();

    const draft = await stub.generate({
      question: "When can I go back to work?",
      summaries: [strep],
    });

    expect(draft.action).toBe("answer");
    expect(draft.urgency).toBe("routine");
    for (const line of [...sections.plan, ...sections.whenToSeekCare]) {
      expect(draft.reply).toContain(line);
      expect(
        draft.evidence.some(
          (e) => e.summaryId === "strep_01" && e.quote === line,
        ),
      ).toBe(true);
    }
  });

  it('Scenario: Stub judge passes only verbatim-grounded drafts', async () => {
    const store = loadSummaryStore(dataDir);
    const strep = store.get("strep_01")!;
    const quote =
      "Finish the full 10-day course even if you feel better sooner.";
    const stub = new StubProvider();
    const draft: TriageResponse = {
      action: "answer",
      urgency: "routine",
      reply: `Please ${quote}`,
      evidence: [{ summaryId: "strep_01", quote }],
      reason: "From plan",
    };

    const verdict = await stub.judge({
      question: "Can I stop early?",
      draft,
      summaries: [strep],
    });

    expect(verdict.supported).toBe(true);
    expect(verdict.unsupportedClaims).toEqual([]);
  });

  it("Scenario: Transient provider errors are retried", async () => {
    let attempts = 0;
    const flaky: LlmProvider = {
      async generate(input: GenerateInput) {
        attempts += 1;
        if (attempts < 3) {
          const err = new Error("rate limited") as Error & { status: number };
          err.status = 429;
          throw err;
        }
        return {
          action: "answer",
          urgency: "routine",
          reply: "ok",
          evidence: [
            {
              summaryId: input.summaries[0]!.summaryId,
              quote: "ok",
            },
          ],
          reason: "recovered",
        };
      },
      async judge() {
        return { supported: true, unsupportedClaims: [] };
      },
    };

    const service = new LlmService(flaky, {
      maxAttempts: 3,
      retryBaseMs: 1,
    });
    const store = loadSummaryStore(dataDir);
    const result = await service.generate({
      question: "q",
      summaries: [store.get("strep_01")!],
    });

    expect(result.reply).toBe("ok");
    expect(attempts).toBe(3);
  });
});
