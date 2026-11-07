import { z } from "zod";

export const EvidenceItemSchema = z.object({
  summaryId: z.string().min(1),
  quote: z.string().min(1),
});

export const TriageResponseSchema = z.object({
  action: z.enum(["answer", "escalate"]),
  urgency: z.enum(["routine", "urgent", "emergency"]),
  reply: z.string().min(1),
  evidence: z.array(EvidenceItemSchema),
  reason: z.string().min(1),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type TriageResponse = z.infer<typeof TriageResponseSchema>;

/** JSON Schema for OpenAI structured output (derived from the zod contract). */
export const TriageResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "urgency", "reply", "evidence", "reason"],
  properties: {
    action: { type: "string", enum: ["answer", "escalate"] },
    urgency: { type: "string", enum: ["routine", "urgent", "emergency"] },
    reply: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["summaryId", "quote"],
        properties: {
          summaryId: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
    reason: { type: "string" },
  },
} as const;
