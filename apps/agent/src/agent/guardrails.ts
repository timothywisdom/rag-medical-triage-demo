import type { TriageResponse } from "../contract.js";

const EMERGENCY_LINE =
  "call 911 or go to the nearest emergency department";
const SAME_DAY_LINE =
  "seek in-person care the same day";

export function applyGuardrails(draft: TriageResponse): TriageResponse {
  let action = draft.action;
  const urgency = draft.urgency;
  let reply = draft.reply;

  if (urgency !== "routine" && action === "answer") {
    action = "escalate";
  }

  if (urgency === "emergency") {
    action = "escalate";
    if (!/911|emergency department/i.test(reply)) {
      reply = appendSentence(reply, `Please ${EMERGENCY_LINE}.`);
    }
  }

  if (urgency === "urgent" && action === "escalate") {
    if (!/same day/i.test(reply)) {
      reply = appendSentence(
        reply,
        `Please ${SAME_DAY_LINE}.`,
      );
    }
  }

  return {
    ...draft,
    action,
    urgency,
    reply,
  };
}

function appendSentence(reply: string, sentence: string): string {
  const trimmed = reply.trim();
  if (!trimmed) return sentence;
  const spacer = /[.!?]$/.test(trimmed) ? " " : ". ";
  return `${trimmed}${spacer}${sentence}`;
}
