import type { TriageResponse } from "../contract.js";
import type { VisitSummary } from "../store.js";

export type TriageTrace = {
  contextSummaryIds: string[];
  missingSummaryIds: string[];
  groundingAttempts: number;
  groundingFailures: string[];
  generateCalls: number;
  judgeCalls: number;
  quoteCheckRan: boolean;
};

export type TriageStateType = {
  question: string;
  summaryIds: string[];
  context: VisitSummary[];
  draft: TriageResponse | null;
  response: TriageResponse | null;
  groundingFeedback: string;
  groundingAttempts: number;
  trace: TriageTrace;
};

export const emptyTrace = (): TriageTrace => ({
  contextSummaryIds: [],
  missingSummaryIds: [],
  groundingAttempts: 0,
  groundingFailures: [],
  generateCalls: 0,
  judgeCalls: 0,
  quoteCheckRan: false,
});
