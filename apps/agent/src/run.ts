import type { AgentConfig } from "./config.js";
import { createLlm } from "./llm/index.js";
import { loadSummaryStore } from "./store.js";
import {
  buildTriageGraph,
  runTriage,
  type TriageInput,
  type TriageResult,
} from "./agent/graph.js";

export function createTriageRunner(config: AgentConfig) {
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
