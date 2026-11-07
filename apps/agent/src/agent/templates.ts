import type { TriageResponse } from "../contract.js";

export const NO_CONTEXT_REPLY =
  "I couldn't find a visit summary for your question, so I'm escalating this to a clinician. If this is an emergency, call 911 or go to the nearest emergency department.";

export function noContextEscalation(): TriageResponse {
  return {
    action: "escalate",
    urgency: "routine",
    reply: NO_CONTEXT_REPLY,
    evidence: [],
    reason: "No visit summary was found for the supplied ids.",
  };
}
