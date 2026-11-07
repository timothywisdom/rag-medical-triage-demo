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

type Route = "escalateNoContext" | "generate" | "verifyAndJudge" | "escalateUngrounded" | typeof END;

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
    const feedback = state.groundingFeedback
      ? `Strengthen evidence quotes to be verbatim from the summaries.\n${state.groundingFeedback}`
      : undefined;
    const prompt = buildGenerationPrompt(
      state.question,
      state.context,
      deps.config.promptVersion,
      feedback,
    );
    const attempts = state.groundingAttempts + 1;
    try {
      const raw = await deps.llm.generate({
        question: state.question,
        summaries: state.context,
        systemPrompt: prompt.system,
        feedback,
      });
      const parsed = TriageResponseSchema.safeParse(raw);
      if (!parsed.success) {
        const invalid = invalidModelEscalation();
        return {
          draft: invalid,
          response: invalid,
          groundingAttempts: attempts,
          groundingFeedback: "",
          trace: {
            ...state.trace,
            generateCalls: state.trace.generateCalls + 1,
            groundingAttempts: attempts,
          },
        };
      }
      return {
        draft: parsed.data,
        response: null,
        groundingAttempts: attempts,
        groundingFeedback: "",
        trace: {
          ...state.trace,
          generateCalls: state.trace.generateCalls + 1,
          groundingAttempts: attempts,
        },
      };
    } catch {
      const invalid = invalidModelEscalation();
      return {
        draft: invalid,
        response: invalid,
        groundingAttempts: attempts,
        trace: {
          ...state.trace,
          generateCalls: state.trace.generateCalls + 1,
          groundingAttempts: attempts,
        },
      };
    }
  };

  const verifyAndJudge = async (state: TriageStateType) => {
    const draft = state.draft;
    if (!draft) {
      return { response: invalidModelEscalation() };
    }
    if (state.response) {
      return {};
    }

    if (!deps.config.groundingCheck) {
      return {
        response: draft,
        trace: {
          ...state.trace,
          groundingAttempts: state.groundingAttempts,
        },
      };
    }

    const quotes = verifyQuotes(draft, state.context);
    let failures = [...quotes.failures];
    let judgeCalls = state.trace.judgeCalls;

    if (quotes.passed) {
      const verdict = await judgeDraft(
        deps.llm,
        draft,
        state.question,
        state.context,
      );
      judgeCalls += 1;
      if (!verdict.supported) {
        failures = [...failures, ...verdict.unsupportedClaims];
      }
    }

    const trace = {
      ...state.trace,
      quoteCheckRan: true,
      judgeCalls,
      groundingAttempts: state.groundingAttempts,
      groundingFailures: [...state.trace.groundingFailures, ...failures],
    };

    if (failures.length === 0) {
      return { response: draft, groundingFeedback: "", trace };
    }

    const canRetry =
      state.groundingAttempts <= deps.config.groundingMaxRetries;
    if (canRetry) {
      return {
        response: null,
        groundingFeedback: failures.join("\n"),
        trace,
      };
    }

    return {
      response: ungroundedEscalation(draft, failures.join("; ")),
      groundingFeedback: failures.join("\n"),
      trace,
    };
  };

  const escalateUngrounded = async (state: TriageStateType) => {
    const draft = state.draft ?? invalidModelEscalation();
    return {
      response: ungroundedEscalation(
        draft,
        state.groundingFeedback || "grounding check failed",
      ),
    };
  };

  const afterRetrieve = (state: TriageStateType): Route =>
    state.context.length === 0 ? "escalateNoContext" : "generate";

  const afterGenerate = (state: TriageStateType): Route =>
    state.response ? END : "verifyAndJudge";

  const afterVerify = (state: TriageStateType): Route => {
    if (state.response) return END;
    if (state.groundingFeedback) {
      return state.groundingAttempts <= deps.config.groundingMaxRetries
        ? "generate"
        : "escalateUngrounded";
    }
    return END;
  };

  return new StateGraph(TriageState)
    .addNode("retrieve", retrieve)
    .addNode("escalateNoContext", escalateNoContext)
    .addNode("generate", generate)
    .addNode("verifyAndJudge", verifyAndJudge)
    .addNode("escalateUngrounded", escalateUngrounded)
    .addEdge(START, "retrieve")
    .addConditionalEdges("retrieve", afterRetrieve)
    .addEdge("escalateNoContext", END)
    .addConditionalEdges("generate", afterGenerate)
    .addConditionalEdges("verifyAndJudge", afterVerify)
    .addEdge("escalateUngrounded", END)
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
