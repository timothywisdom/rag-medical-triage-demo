/**
 * Spec: ≥10 adversarial eval cases plus provided cases; reply checks declared.
 * Feature: Eval cases
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { loadEvalCases } from "../../apps/eval/src/cases.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Eval cases", () => {
  it("Scenario: Case file merges provided and custom cases", () => {
    const store = loadSummaryStore(dataDir);
    const cases = loadEvalCases();
    expect(cases.length).toBeGreaterThanOrEqual(25);

    const ids = new Set<string>();
    for (const c of cases) {
      expect(c.case_id).toBeTruthy();
      expect(c.summary_ids.length).toBeGreaterThan(0);
      expect(c.question).toBeTruthy();
      expect(["answer", "escalate"]).toContain(c.expected_action);
      expect(["routine", "urgent", "emergency"]).toContain(c.expected_urgency);
      expect(c.notes).toBeTruthy();
      for (const id of c.summary_ids) {
        expect(store.get(id)).toBeDefined();
      }
      expect(ids.has(c.case_id)).toBe(false);
      ids.add(c.case_id);
    }
  });

  it("Scenario: Reply checks are declared per case", () => {
    const cases = loadEvalCases();
    const byId = new Map(cases.map((c) => [c.case_id, c]));

    expect(byId.get("case_07")?.must_match?.join(" ")).toMatch(
      /911|emergency department/,
    );
    expect(byId.get("case_14")?.must_match?.join(" ")).toMatch(
      /911|emergency department/,
    );
    expect(byId.get("case_11")?.must_match?.join(" ")).toMatch(/face/);
    expect(byId.get("case_08")?.must_not_match?.join(" ")).toMatch(/mL|ml/);
  });
});
