import type { TriageResponse } from "../contract.js";
import type { VisitSummary } from "../store.js";

export type GenerateInput = {
  question: string;
  summaries: VisitSummary[];
  systemPrompt?: string;
  feedback?: string;
};

export type JudgeInput = {
  question: string;
  draft: TriageResponse;
  summaries: VisitSummary[];
};

export type JudgeVerdict = {
  supported: boolean;
  unsupportedClaims: string[];
};

export interface LlmProvider {
  generate(input: GenerateInput): Promise<TriageResponse>;
  judge(input: JudgeInput): Promise<JudgeVerdict>;
}

export type LlmServiceOptions = {
  maxAttempts: number;
  retryBaseMs: number;
};

export function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  const code = (error as { code?: string }).code;
  return code === "ETIMEDOUT" || code === "ECONNRESET";
}
