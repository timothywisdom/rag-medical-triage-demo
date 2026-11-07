/**
 * Spec: key/value visit summary store; multi-visit patients; scoped retrieval by ids.
 * Feature: Visit summary store
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  loadSummaryStore,
  parseSections,
} from "../../apps/agent/src/store.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Visit summary store", () => {
  it('Scenario: Fetch summaries by id, newest first', () => {
    const store = loadSummaryStore(dataDir);
    const { found, missing } = store.getMany(["uti_01", "strep_01"]);

    expect(missing).toEqual([]);
    expect(found.map((s) => s.summaryId)).toEqual(["strep_01", "uti_01"]);
    for (const summary of found) {
      expect(summary.visitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(summary.text.length).toBeGreaterThan(50);
      expect(summary.patientId).toBeTruthy();
    }
  });

  it("Scenario: Unknown ids are reported, not invented", () => {
    const store = loadSummaryStore(dataDir);
    const { found, missing } = store.getMany(["strep_01", "nope_99"]);

    expect(found.map((s) => s.summaryId)).toEqual(["strep_01"]);
    expect(missing).toEqual(["nope_99"]);
  });

  it("Scenario: Sections are parsed for downstream use", () => {
    const store = loadSummaryStore(dataDir);
    const asthma = store.get("asthma_01");
    expect(asthma).toBeDefined();
    const sections = parseSections(asthma!.text);

    expect(sections.plan).toHaveLength(3);
    expect(sections.whenToSeekCare).toHaveLength(2);
    expect(sections.whenToSeekCare.some((line) => /call 911/i.test(line))).toBe(
      true,
    );

    for (const line of [...sections.plan, ...sections.whenToSeekCare]) {
      expect(asthma!.text).toContain(line);
    }
  });

  it('Scenario: Patient directory lists each patient\'s summary ids', () => {
    const store = loadSummaryStore(dataDir);
    const patients = store.listPatients();
    const multi = patients.find((p) => p.patientId === "multi_01");

    expect(multi).toBeDefined();
    expect(multi!.summaryIds).toEqual(["strep_02", "uti_02"]);
  });
});
