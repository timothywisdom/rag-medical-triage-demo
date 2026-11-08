import type { AgentConfig } from "./config.js";
import { createLlm } from "./llm/index.js";
import { loadSummaryStore, type SummaryStore } from "./store.js";
import {
  buildTriageGraph,
  runTriage,
  type TriageInput,
  type TriageResult,
} from "./agent/graph.js";

export type TriageRunner = {
  store: SummaryStore;
  triage(input: TriageInput): Promise<TriageResult>;
};

export function createTriageRunner(config: AgentConfig): TriageRunner {
  const store = loadSummaryStore(config.dataDir);
  const llm = createLlm(config);
  const graph = buildTriageGraph({ store, llm, config });

  return {
    store,
    async triage(input: TriageInput): Promise<TriageResult> {
      return runTriage(input, { graph });
    },
  };
}
