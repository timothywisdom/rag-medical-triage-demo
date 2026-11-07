import type { TriageResponse } from "../contract.js";
import { parseSections } from "../store.js";
import type {
  GenerateInput,
  JudgeInput,
  JudgeVerdict,
  LlmProvider,
} from "./types.js";

export class StubProvider implements LlmProvider {
  async generate(input: GenerateInput): Promise<TriageResponse> {
    const evidence: TriageResponse["evidence"] = [];
    const replyParts: string[] = [];

    for (const summary of input.summaries) {
      const sections = parseSections(summary.text);
      for (const line of [...sections.plan, ...sections.whenToSeekCare]) {
        replyParts.push(line);
        evidence.push({ summaryId: summary.summaryId, quote: line });
      }
    }

    return {
      action: "answer",
      urgency: "routine",
      reply: replyParts.join("\n"),
      evidence,
      reason: "Stub echoed Plan and When to seek care from the visit summaries.",
    };
  }

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    const unsupportedClaims: string[] = [];
    for (const item of input.draft.evidence) {
      const summary = input.summaries.find((s) => s.summaryId === item.summaryId);
      if (!summary || !summary.text.includes(item.quote)) {
        unsupportedClaims.push(item.quote);
      }
    }
    return {
      supported: unsupportedClaims.length === 0,
      unsupportedClaims,
    };
  }
}
