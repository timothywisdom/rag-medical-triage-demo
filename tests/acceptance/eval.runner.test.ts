/**
 * Spec: Separate eval harness; persist comparable run logs.
 * Feature: Eval runner
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { loadEvalCases } from "../../apps/eval/src/cases.js";
import { compareRuns, runEval } from "../../apps/eval/src/runner.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Eval runner", () => {
  it("Scenario: Run all cases and persist a labelled log", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "maple-eval-"));
    const cases = loadEvalCases().filter((c) =>
      ["case_04", "case_05", "case_01"].includes(c.case_id),
    );
    const config = configFromEnv({
      LLM_PROVIDER: "stub",
      PROMPT_VERSION: "v1",
      GROUNDING_CHECK: "0",
      DATA_DIR: dataDir,
    });

    const { jsonPath, mdPath, log } = await runEval({
      config,
      cases,
      outDir,
      label: "v1-stub",
    });

    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(mdPath)).toBe(true);
    expect(log.config.promptVersion).toBe("v1");
    expect(log.results).toHaveLength(3);
    expect(log.metrics.accuracy).toBeGreaterThanOrEqual(0);
    expect(log.metrics.accuracy).toBeLessThanOrEqual(1);
    expect(readFileSync(mdPath, "utf8")).toMatch(/accuracy/i);
  });

  it("Scenario: Compare two runs", () => {
    const before = {
      label: "before",
      results: [
        { caseId: "a", correct: true },
        { caseId: "b", correct: false },
      ],
      metrics: {
        accuracy: 0.5,
        actionAccuracy: 0.5,
        urgencyAccuracy: 1,
        underTriageRate: 0.1,
        emergencyRecall: 1,
      },
    };
    const after = {
      label: "after",
      results: [
        { caseId: "a", correct: true },
        { caseId: "b", correct: true },
      ],
      metrics: {
        accuracy: 1,
        actionAccuracy: 1,
        urgencyAccuracy: 1,
        underTriageRate: 0,
        emergencyRecall: 1,
      },
    };
    const report = compareRuns(before, after);
    expect(report).toMatch(/accuracy/i);
    expect(report).toMatch(/actionAccuracy/i);
    expect(report).toMatch(/urgencyAccuracy/i);
    expect(report).toMatch(/b/);
    expect(report).toMatch(/flipped|improved|incorrect → correct/i);
  });
});
