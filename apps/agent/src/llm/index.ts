import type { AgentConfig } from "../config.js";
import { OpenAIProvider } from "./openai.js";
import { LlmService } from "./service.js";
import { StubProvider } from "./stub.js";
import type { LlmProvider } from "./types.js";

export { StubProvider } from "./stub.js";
export { OpenAIProvider } from "./openai.js";
export { LlmService } from "./service.js";
export type {
  GenerateInput,
  JudgeInput,
  JudgeVerdict,
  LlmProvider,
} from "./types.js";

export function createLlm(config: AgentConfig): LlmService {
  const provider: LlmProvider =
    config.llmProvider === "openai"
      ? new OpenAIProvider({
          apiKey: config.openaiApiKey!,
          model: config.openaiModel,
        })
      : new StubProvider();

  return new LlmService(provider, {
    maxAttempts: config.maxLlmAttempts,
    retryBaseMs: config.retryBaseMs,
  });
}
