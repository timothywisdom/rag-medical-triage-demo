import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type VisitSummary = {
  summaryId: string;
  patientId: string;
  displayName: string;
  visitDate: string;
  text: string;
};

export type PatientRecord = {
  patientId: string;
  displayName: string;
  summaryIds: string[];
};

export type SummarySections = {
  plan: string[];
  whenToSeekCare: string[];
};

export type GetManyResult = {
  found: VisitSummary[];
  missing: string[];
};

export type SummaryStore = {
  get(summaryId: string): VisitSummary | undefined;
  getMany(summaryIds: string[]): GetManyResult;
  listPatients(): PatientRecord[];
};

type MetaEntry = {
  patientId: string;
  displayName: string;
  visitDate: string;
};

type JsonlRow = {
  summary_id: string;
  text: string;
};

export function loadSummaryStore(dataDir: string): SummaryStore {
  const starterPath = resolve(dataDir, "visit_summaries.jsonl");
  const dataRoot = resolve(dataDir, "..", "data");
  const metaPath = resolve(dataRoot, "summary_meta.json");
  const extraPath = resolve(dataRoot, "extra_summaries.jsonl");

  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<
    string,
    MetaEntry
  >;
  const rows = [
    ...readJsonl(starterPath),
    ...readJsonl(extraPath),
  ];

  const byId = new Map<string, VisitSummary>();
  for (const row of rows) {
    const entry = meta[row.summary_id];
    if (!entry) {
      throw new Error(
        `Missing metadata for summary_id "${row.summary_id}" in ${metaPath}`,
      );
    }
    byId.set(row.summary_id, {
      summaryId: row.summary_id,
      patientId: entry.patientId,
      displayName: entry.displayName,
      visitDate: entry.visitDate,
      text: row.text,
    });
  }

  return {
    get(summaryId) {
      return byId.get(summaryId);
    },
    getMany(summaryIds) {
      const found: VisitSummary[] = [];
      const missing: string[] = [];
      for (const id of summaryIds) {
        const summary = byId.get(id);
        if (summary) found.push(summary);
        else missing.push(id);
      }
      found.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
      return { found, missing };
    },
    listPatients() {
      const grouped = new Map<string, PatientRecord>();
      for (const summary of byId.values()) {
        let patient = grouped.get(summary.patientId);
        if (!patient) {
          patient = {
            patientId: summary.patientId,
            displayName: summary.displayName,
            summaryIds: [],
          };
          grouped.set(summary.patientId, patient);
        }
        patient.summaryIds.push(summary.summaryId);
      }
      for (const patient of grouped.values()) {
        patient.summaryIds.sort((a, b) => {
          const left = byId.get(a)!.visitDate;
          const right = byId.get(b)!.visitDate;
          return right.localeCompare(left);
        });
      }
      return [...grouped.values()].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
    },
  };
}

export function parseSections(text: string): SummarySections {
  const plan = bulletsUnderHeader(text, "Plan:");
  const whenToSeekCare = bulletsUnderHeader(text, "When to seek care:");
  return { plan, whenToSeekCare };
}

function bulletsUnderHeader(text: string, header: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return [];

  const bullets: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      if (bullets.length > 0) break;
      continue;
    }
    if (/^[A-Za-z].*:$/.test(trimmed) && !trimmed.startsWith("-")) break;
    if (trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2));
    }
  }
  return bullets;
}

function readJsonl(path: string): JsonlRow[] {
  const text = readFileSync(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonlRow);
}
