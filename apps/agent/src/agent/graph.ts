import { END, START, StateGraph } from "@langchain/langgraph";
import type { AgentConfig } from "../config.js";
import type { TriageResponse } from "../contract.js";
import type { LlmProvider } from "../llm/types.js";
import type { SummaryStore } from "../store.js";
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

  // Placeholder until generation (item 5) is wired.
  const awaitGeneration = async (state: TriageStateType) => ({
    response: {
      action: "escalate" as const,
      urgency: "routine" as const,
      reply: "Generation not yet implemented.",
      evidence: [],
      reason: "Placeholder path after retrieval.",
    },
    draft: null,
    trace: state.trace,
  });

  return new StateGraph(TriageState)
    .addNode("retrieve", retrieve)
    .addNode("escalateNoContext", escalateNoContext)
    .addNode("awaitGeneration", awaitGeneration)
    .addEdge(START, "retrieve")
    .addConditionalEdges("retrieve", (state) =>
      state.context.length === 0 ? "escalateNoContext" : "awaitGeneration",
    )
    .addEdge("escalateNoContext", END)
    .addEdge("awaitGeneration", END)
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
