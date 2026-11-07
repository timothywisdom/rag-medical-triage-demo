import { END, START, StateGraph } from "@langchain/langgraph";
import type { AgentConfig } from "../config.js";
import { TriageResponseSchema, type TriageResponse } from "../contract.js";
import type { LlmProvider } from "../llm/types.js";
import type { SummaryStore } from "../store.js";
import { judgeDraft } from "./grounding/judge.js";
import { verifyQuotes } from "./grounding/quotes.js";
import { buildGenerationPrompt } from "./prompts/index.js";
import { emptyTrace, TriageState, type TriageStateType } from "./state.js";
import { noContextEscalation } from "./templates.js";

export type TriageDeps = {
  store: SummaryStore;
  llm: LlmProvider;
  config: AgentConfig;
};

export type TriageInput = {
  question: string;
  summaryIds: string[];
};

export type TriageResult = {
  response: TriageResponse;
  trace: TriageStateType["trace"];
};

export function buildTriageGraph(deps: TriageDeps) {
  const retrieve = async (state: TriageStateType) => {
    const { found, missing } = deps.store.getMany(state.summaryIds);
    return {
      context: found,
      trace: {
        ...state.trace,
        contextSummaryIds: found.map((s) => s.summaryId),
        missingSummaryIds: missing,
      },
    };
  };

  const escalateNoContext = async () => ({
    response: noContextEscalation(),
    draft: noContextEscalation(),
  });

  const generate = async (state: TriageStateType) => {
    const prompt = buildGenerationPrompt(
      state.question,
      state.context,
      deps.config.promptVersion,
      state.groundingFeedback || undefined,
    );
    try {
      const raw = await deps.llm.generate({
        question: state.question,
        summaries: state.context,
        systemPrompt: prompt.system,
        feedback: state.groundingFeedback || undefined,
      });
      const parsed = TriageResponseSchema.safeParse(raw);
      if (!parsed.success) {
        const invalid = invalidModelEscalation();
        return {
          draft: invalid,
          response: invalid,
          groundingAttempts: state.groundingAttempts + 1,
          trace: {
            ...state.trace,
            generateCalls: state.trace.generateCalls + 1,
          },
        };
      }
      return {
        draft: parsed.data,
        response: null,
        groundingAttempts: state.groundingAttempts + 1,
        groundingFeedback: "",
        trace: {
          ...state.trace,
          generateCalls: state.trace.generateCalls + 1,
        },
      };
    } catch {
      const invalid = invalidModelEscalation();
      return {
        draft: invalid,
        response: invalid,
        groundingAttempts: state.groundingAttempts + 1,
        trace: {
          ...state.trace,
          generateCalls: state.trace.generateCalls + 1,
        },
      };
    }
  };

  const verifyAndJudge = async (state: TriageStateType) => {
    const draft = state.draft;
    if (!draft) {
      return { response: invalidModelEscalation() };
    }
    // Already escalated due to invalid model output.
    if (state.response) {
      return {};
    }

    if (!deps.config.groundingCheck) {
      return { response: draft };
    }

    const quotes = verifyQuotes(draft, state.context);
    const traceBase = {
      ...state.trace,
      quoteCheckRan: true,
    };
    if (!quotes.passed) {
      return {
        response: ungroundedEscalation(draft, quotes.failures.join("; ")),
        groundingFeedback: quotes.failures.join("\n"),
        trace: {
          ...traceBase,
          groundingFailures: [
            ...traceBase.groundingFailures,
            ...quotes.failures,
          ],
        },
      };
    }

    const verdict = await judgeDraft(
      deps.llm,
      draft,
      state.question,
      state.context,
    );
    const judgeTrace = {
      ...traceBase,
      judgeCalls: traceBase.judgeCalls + 1,
    };
    if (!verdict.supported) {
      const reasons = verdict.unsupportedClaims;
      return {
        response: ungroundedEscalation(draft, reasons.join("; ")),
        groundingFeedback: reasons.join("\n"),
        trace: {
          ...judgeTrace,
          groundingFailures: [...judgeTrace.groundingFailures, ...reasons],
        },
      };
    }

    return {
      response: draft,
      trace: judgeTrace,
    };
  };

  return new StateGraph(TriageState)
    .addNode("retrieve", retrieve)
    .addNode("escalateNoContext", escalateNoContext)
    .addNode("generate", generate)
    .addNode("verifyAndJudge", verifyAndJudge)
    .addEdge(START, "retrieve")
    .addConditionalEdges("retrieve", (state) =>
      state.context.length === 0 ? "escalateNoContext" : "generate",
    )
    .addEdge("escalateNoContext", END)
    .addConditionalEdges("generate", (state) =>
      state.response ? END : "verifyAndJudge",
    )
    .addEdge("verifyAndJudge", END)
    .compile();
}

export async function runTriage(
  input: TriageInput,
  options: { graph: ReturnType<typeof buildTriageGraph> },
): Promise<TriageResult> {
  const finalState = await options.graph.invoke({
    question: input.question,
    summaryIds: input.summaryIds,
    context: [],
    draft: null,
    response: null,
    groundingFeedback: "",
    groundingAttempts: 0,
    trace: emptyTrace(),
  });

  if (!finalState.response) {
    throw new Error("Triage graph ended without a response.");
  }

  return {
    response: finalState.response,
    trace: finalState.trace,
  };
}

function invalidModelEscalation(): TriageResponse {
  return {
    action: "escalate",
    urgency: "routine",
    reply: noContextEscalation().reply.replace(
      "I couldn't find a visit summary for your question",
      "I couldn't produce a reliable answer from the visit summary",
    ),
    evidence: [],
    reason: "Invalid model response; escalating to a clinician.",
  };
}

function ungroundedEscalation(
  draft: TriageResponse,
  detail: string,
): TriageResponse {
  return {
    action: "escalate",
    urgency: draft.urgency,
    reply:
      "I'm escalating this to a clinician because I couldn't verify the answer against your visit summary. If this is an emergency, call 911 or go to the nearest emergency department.",
    evidence: draft.evidence,
    reason: `Grounding check failed: ${detail}`,
  };
}
