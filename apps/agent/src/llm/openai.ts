import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import {
  TriageResponseSchema,
  type TriageResponse,
} from "../contract.js";
import type {
  GenerateInput,
  JudgeInput,
  JudgeVerdict,
  LlmProvider,
} from "./types.js";

const JudgeSchema = z.object({
  supported: z.boolean(),
  unsupported_claims: z.array(z.string()),
});

export type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
};

export class OpenAIProvider implements LlmProvider {
  private readonly model: ChatOpenAI;

  constructor(options: OpenAIProviderOptions) {
    this.model = new ChatOpenAI({
      apiKey: options.apiKey,
      model: options.model,
      temperature: 0,
    });
  }

  async generate(input: GenerateInput): Promise<TriageResponse> {
    const structured = this.model.withStructuredOutput(TriageResponseSchema);
    const context = input.summaries
      .map(
        (s) =>
          `<summary id="${s.summaryId}" visitDate="${s.visitDate}">\n${s.text}\n</summary>`,
      )
      .join("\n\n");
    const system =
      input.systemPrompt ??
      [
        "You are a medical follow-up triage assistant.",
        "Answer only from the visit summaries. Escalate when unsure.",
        "Every evidence quote must be copied verbatim from a summary.",
      ].join(" ");

    const user = [
      context,
      "",
      "<patient_question untrusted=\"true\">",
      input.question,
      "</patient_question>",
      input.feedback ? `\nPrevious grounding failures:\n${input.feedback}` : "",
    ].join("\n");

    const draft = await structured.invoke([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return TriageResponseSchema.parse(draft);
  }

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    const structured = this.model.withStructuredOutput(JudgeSchema);
    const evidence = input.draft.evidence
      .map((e) => `- [${e.summaryId}] ${e.quote}`)
      .join("\n");
    const result = await structured.invoke([
      {
        role: "system",
        content:
          'Decide whether every medical claim in the reply is supported by the evidence. Respond with JSON {"supported": boolean, "unsupported_claims": string[]}.',
      },
      {
        role: "user",
        content: [
          `Question: ${input.question}`,
          `Evidence:\n${evidence}`,
          `Reply:\n${input.draft.reply}`,
        ].join("\n\n"),
      },
    ]);
    const parsed = JudgeSchema.parse(result);
    return {
      supported: parsed.supported,
      unsupportedClaims: parsed.unsupported_claims,
    };
  }
}
