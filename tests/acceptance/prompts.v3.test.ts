/**
 * Feature: Prompt v3 — answer when Plan already covers a named medication.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { buildGenerationPrompt } from "../../apps/agent/src/agent/prompts/index.js";
import { SYSTEM_V2 } from "../../apps/agent/src/agent/prompts/v2.js";
import { SYSTEM_V3 } from "../../apps/agent/src/agent/prompts/v3.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Prompt v3 named-med Plan answers", () => {
  it("Scenario: v3 requires answer when evidence already covers a named Plan instruction", () => {
    const store = loadSummaryStore(dataDir);
    const { found } = store.getMany(["strep_02", "uti_02"]);
    const prompt = buildGenerationPrompt(
      "Should I take Nitrofurantoin with food?",
      found,
      "v3",
    );

    expect(prompt.system).toBe(SYSTEM_V3);
    expect(prompt.system).toMatch(/Plan in the cited summary already answers/i);
    expect(prompt.system).toMatch(/take with food/i);
    expect(prompt.system).toMatch(
      /never escalate while quoting a matching Plan line/i,
    );
    expect(prompt.system).toMatch(/NOT named in the cited summary/i);
  });

  it("Scenario: v2 baseline is unchanged for comparison", () => {
    const store = loadSummaryStore(dataDir);
    const { found } = store.getMany(["uti_02"]);
    const prompt = buildGenerationPrompt("q", found, "v2");
    expect(prompt.system).toBe(SYSTEM_V2);
    expect(prompt.system).not.toMatch(
      /never escalate while quoting a matching Plan line/i,
    );
  });
});
