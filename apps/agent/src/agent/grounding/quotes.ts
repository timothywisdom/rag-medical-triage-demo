import type { TriageResponse } from "../../contract.js";
import type { VisitSummary } from "../../store.js";

export type QuoteCheckResult = {
  passed: boolean;
  failures: string[];
};

export function verifyQuotes(
  draft: TriageResponse,
  summaries: VisitSummary[],
): QuoteCheckResult {
  if (draft.action === "escalate" && draft.evidence.length === 0) {
    return { passed: true, failures: [] };
  }

  if (draft.action === "answer" && draft.evidence.length === 0) {
    return {
      passed: false,
      failures: ["Answer action requires at least one evidence quote."],
    };
  }

  const byId = new Map(summaries.map((s) => [s.summaryId, s]));
  const failures: string[] = [];

  for (const item of draft.evidence) {
    const summary = byId.get(item.summaryId);
    if (!summary) {
      failures.push(
        `Quote cites unknown summary "${item.summaryId}": ${item.quote}`,
      );
      continue;
    }
    if (!includesNormalized(summary.text, item.quote)) {
      failures.push(
        `Quote not found verbatim in ${item.summaryId}: ${item.quote}`,
      );
    }
  }

  return { passed: failures.length === 0, failures };
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
