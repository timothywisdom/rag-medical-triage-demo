import type { TriageResponse } from "../../contract.js";
import type { LlmProvider, JudgeVerdict } from "../../llm/types.js";
import type { VisitSummary } from "../../store.js";

export function buildJudgePrompt(
  question: string,
  draft: TriageResponse,
): string {
  const evidence = draft.evidence
    .map((e) => `- [${e.summaryId}] ${e.quote}`)
    .join("\n");
  return [
    "Decide whether every medical claim in the reply is supported by the evidence.",
    'Respond with JSON {"supported": boolean, "unsupported_claims": string[]}.',
    "",
    `Question: ${question}`,
    "",
    "Evidence:",
    evidence || "(none)",
    "",
    "Reply:",
    draft.reply,
  ].join("\n");
}

export async function judgeDraft(
  llm: LlmProvider,
  draft: TriageResponse,
  question: string,
  summaries: VisitSummary[],
): Promise<JudgeVerdict> {
  try {
    const verdict = await llm.judge({ question, draft, summaries });
    if (
      typeof verdict?.supported !== "boolean" ||
      !Array.isArray(verdict.unsupportedClaims)
    ) {
      return {
        supported: false,
        unsupportedClaims: ["Unparseable judge output"],
      };
    }
    return verdict;
  } catch {
    return {
      supported: false,
      unsupportedClaims: ["Unparseable judge output"],
    };
  }
}
