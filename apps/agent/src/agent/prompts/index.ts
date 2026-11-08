import type { VisitSummary } from "../../store.js";
import { SYSTEM_V1 } from "./v1.js";
import { SYSTEM_V2 } from "./v2.js";
import { SYSTEM_V3 } from "./v3.js";

export type PromptVersion = "v1" | "v2" | "v3";

export type BuiltPrompt = {
  system: string;
  user: string;
};

export function buildGenerationPrompt(
  question: string,
  summaries: VisitSummary[],
  version: PromptVersion,
  feedback?: string,
): BuiltPrompt {
  const system = systemFor(version);
  const blocks = summaries
    .map(
      (s) =>
        `<summary id="${s.summaryId}" visitDate="${s.visitDate}">\n${s.text}\n</summary>`,
    )
    .join("\n\n");

  const parts = [
    blocks,
    "",
    `<patient_question untrusted="true">\n${question}\n</patient_question>`,
  ];
  if (feedback?.trim()) {
    parts.push(
      "",
      "<grounding_feedback>",
      "Previous attempt failed grounding. Strengthen evidence quotes to be verbatim from the summaries.",
      feedback,
      "</grounding_feedback>",
    );
  }

  return { system, user: parts.join("\n") };
}

function systemFor(version: PromptVersion): string {
  if (version === "v1") return SYSTEM_V1;
  if (version === "v2") return SYSTEM_V2;
  if (version === "v3") return SYSTEM_V3;
  throw new Error(`Unknown PROMPT_VERSION: ${version}`);
}
