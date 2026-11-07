import { Annotation } from "@langchain/langgraph";
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

export const emptyTrace = (): TriageTrace => ({
  contextSummaryIds: [],
  missingSummaryIds: [],
  groundingAttempts: 0,
  groundingFailures: [],
  generateCalls: 0,
  judgeCalls: 0,
  quoteCheckRan: false,
});

export const TriageState = Annotation.Root({
  question: Annotation<string>({
    reducer: (_, right) => right,
    default: () => "",
  }),
  summaryIds: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  context: Annotation<VisitSummary[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  draft: Annotation<TriageResponse | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  response: Annotation<TriageResponse | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  groundingFeedback: Annotation<string>({
    reducer: (_, right) => right,
    default: () => "",
  }),
  groundingAttempts: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  trace: Annotation<TriageTrace>({
    reducer: (_, right) => right,
    default: () => emptyTrace(),
  }),
});

export type TriageStateType = typeof TriageState.State;
