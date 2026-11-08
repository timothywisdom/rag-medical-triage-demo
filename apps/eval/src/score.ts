import type { TriageResponse } from "@maple/agent/contract";
import type { EvalCase } from "./cases.js";

const urgencyRank = { routine: 0, urgent: 1, emergency: 2 } as const;
const actionRank = { answer: 0, escalate: 1 } as const;

export type CaseScore = {
  caseId: string;
  correct: boolean;
  actionMatch: boolean;
  urgencyMatch: boolean;
  underTriage: boolean;
  overTriage: boolean;
  replyCheckFailed: boolean;
  groundingFailed: boolean;
  expectedEmergency: boolean;
  predictedEmergency: boolean;
};

export type ScoreSummary = {
  accuracy: number;
  actionAccuracy: number;
  urgencyAccuracy: number;
  underTriageRate: number;
  overTriageRate: number;
  emergencyRecall: number | null;
  total: number;
  correct: number;
  actionCorrect: number;
  urgencyCorrect: number;
  underTriage: number;
  overTriage: number;
};

export function scoreCase(
  evalCase: EvalCase,
  actual: TriageResponse,
  options?: { groundingFailed?: boolean },
): CaseScore {
  const replyCheckFailed = !passesReplyChecks(evalCase, actual.reply);
  const actionMatch = evalCase.expected_action === actual.action;
  const urgencyMatch = evalCase.expected_urgency === actual.urgency;
  const correct = actionMatch && urgencyMatch && !replyCheckFailed;

  const expectedSeverity =
    actionRank[evalCase.expected_action] * 10 +
    urgencyRank[evalCase.expected_urgency];
  const actualSeverity =
    actionRank[actual.action] * 10 + urgencyRank[actual.urgency];

  return {
    caseId: evalCase.case_id,
    correct,
    actionMatch,
    urgencyMatch,
    underTriage: actualSeverity < expectedSeverity,
    overTriage: actualSeverity > expectedSeverity,
    replyCheckFailed,
    groundingFailed: options?.groundingFailed ?? false,
    expectedEmergency: evalCase.expected_urgency === "emergency",
    predictedEmergency: actual.urgency === "emergency",
  };
}

export function summarize(scores: CaseScore[]): ScoreSummary {
  const total = scores.length;
  const correct = scores.filter((s) => s.correct).length;
  const actionCorrect = scores.filter((s) => s.actionMatch).length;
  const urgencyCorrect = scores.filter((s) => s.urgencyMatch).length;
  const underTriage = scores.filter((s) => s.underTriage).length;
  const overTriage = scores.filter((s) => s.overTriage).length;
  const expectedEmergencies = scores.filter((s) => s.expectedEmergency);
  const emergencyHits = expectedEmergencies.filter(
    (s) => s.predictedEmergency,
  ).length;

  return {
    accuracy: total === 0 ? 0 : correct / total,
    actionAccuracy: total === 0 ? 0 : actionCorrect / total,
    urgencyAccuracy: total === 0 ? 0 : urgencyCorrect / total,
    underTriageRate: total === 0 ? 0 : underTriage / total,
    overTriageRate: total === 0 ? 0 : overTriage / total,
    emergencyRecall:
      expectedEmergencies.length === 0
        ? null
        : emergencyHits / expectedEmergencies.length,
    total,
    correct,
    actionCorrect,
    urgencyCorrect,
    underTriage,
    overTriage,
  };
}

function passesReplyChecks(evalCase: EvalCase, reply: string): boolean {
  for (const pattern of evalCase.must_match ?? []) {
    if (!new RegExp(pattern, "i").test(reply)) return false;
  }
  for (const pattern of evalCase.must_not_match ?? []) {
    if (new RegExp(pattern, "i").test(reply)) return false;
  }
  return true;
}
