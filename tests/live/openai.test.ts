/**
 * Opt-in live smoke against OpenAI. Skipped unless LIVE=1.
 * Spec item 3b: case_04 through the OpenAI provider parses against the contract.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadEnvFile, configFromEnv } from "../../apps/agent/src/config.js";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { TriageResponseSchema } from "../../apps/agent/src/contract.js";
import { createLlm } from "../../apps/agent/src/llm/index.js";

const live = process.env.LIVE === "1";

describe.runIf(live)("Live OpenAI smoke", () => {
  it("case_04 produces a contract-valid triage response", async () => {
    loadEnvFile(".env.local");
    const config = configFromEnv({
      ...process.env,
      LLM_PROVIDER: "openai",
    });
    const store = loadSummaryStore(resolve(process.cwd(), "take_home_starter"));
    const llm = createLlm(config);
    const draft = await llm.generate({
      question: "When can I go back to work?",
      summaries: [store.get("strep_01")!],
    });
    expect(TriageResponseSchema.safeParse(draft).success).toBe(true);
  }, 60_000);
});
