/**
 * Spec: One improvement iteration — prompt v2 targeting seek-care, brand map, single-visit citation.
 * Feature: Prompt v2 rules
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { buildGenerationPrompt } from "../../apps/agent/src/agent/prompts/index.js";
import { SYSTEM_V1 } from "../../apps/agent/src/agent/prompts/v1.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Prompt v2 rules", () => {
  it("Scenario: v2 instructs a seek-care rule check before answering", () => {
    const store = loadSummaryStore(dataDir);
    const { found } = store.getMany(["strep_02", "uti_02"]);
    const prompt = buildGenerationPrompt("q", found, "v2");

    expect(prompt.system).toMatch(/When to seek care/i);
    expect(prompt.system).toMatch(/quote the matching rule/i);
    expect(prompt.system).toMatch(/brand names to generics/i);
    expect(prompt.system).toMatch(/one visit/i);
    expect(prompt.system).toMatch(/cite only that visit/i);
    expect(prompt.system).toMatch(/routine urgency/i);
    expect(prompt.system).toMatch(/conflict/i);
  });

  it("Scenario: v1 remains available for reproducing the baseline", () => {
    const store = loadSummaryStore(dataDir);
    const { found } = store.getMany(["strep_01"]);
    const prompt = buildGenerationPrompt("q", found, "v1");
    expect(prompt.system).toBe(SYSTEM_V1);
  });
});
