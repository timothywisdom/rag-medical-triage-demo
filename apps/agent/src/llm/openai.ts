import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import {
  TriageResponseSchema,
  type TriageResponse,
} from "../contract.js";
import type { TokenUsage } from "./pricing.js";
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
  private lastUsage: TokenUsage | undefined;

  constructor(options: OpenAIProviderOptions) {
    this.model = new ChatOpenAI({
      apiKey: options.apiKey,
      model: options.model,
      temperature: 0,
    });
  }

  takeLastUsage(): TokenUsage | undefined {
    const usage = this.lastUsage;
    this.lastUsage = undefined;
    return usage;
  }

  async generate(input: GenerateInput): Promise<TriageResponse> {
    const structured = this.model.withStructuredOutput(TriageResponseSchema, {
      includeRaw: true,
    });
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

    const result = await structured.invoke([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    this.lastUsage = usageFromRaw(result.raw);
    return TriageResponseSchema.parse(result.parsed);
  }

  async judge(input: JudgeInput): Promise<JudgeVerdict> {
    const structured = this.model.withStructuredOutput(JudgeSchema, {
      includeRaw: true,
    });
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
    this.lastUsage = usageFromRaw(result.raw);
    const parsed = JudgeSchema.parse(result.parsed);
    return {
      supported: parsed.supported,
      unsupportedClaims: parsed.unsupported_claims,
    };
  }
}

function usageFromRaw(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const meta = (raw as { usage_metadata?: Record<string, unknown> })
    .usage_metadata;
  if (!meta || typeof meta !== "object") return undefined;

  const inputTokens = numberOrZero(
    meta.input_tokens ?? meta.prompt_tokens ?? meta.inputTokens,
  );
  const outputTokens = numberOrZero(
    meta.output_tokens ?? meta.completion_tokens ?? meta.outputTokens,
  );
  const totalTokens = numberOrZero(
    meta.total_tokens ?? meta.totalTokens ?? inputTokens + outputTokens,
  );
  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) {
    return undefined;
  }
  return { inputTokens, outputTokens, totalTokens };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
