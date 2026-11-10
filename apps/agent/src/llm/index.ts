import type { AgentConfig } from "../config.js";
import { OpenAIProvider } from "./openai.js";
import { LlmService } from "./service.js";
import { StubProvider } from "./stub.js";
import { initLlmTelemetry } from "./telemetry.js";
import type { LlmProvider } from "./types.js";

export { StubProvider } from "./stub.js";
export { OpenAIProvider } from "./openai.js";
export { LlmService } from "./service.js";
export { initLlmTelemetry } from "./telemetry.js";
export { estimateCostUsd } from "./pricing.js";
export type {
  GenerateInput,
  JudgeInput,
  JudgeVerdict,
  LlmProvider,
} from "./types.js";
export type { LlmCallTelemetry } from "./telemetry.js";
export type { TokenUsage } from "./pricing.js";

export function createLlm(config: AgentConfig): LlmService {
  initLlmTelemetry("maple-agent");

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
    providerName: config.llmProvider,
    model:
      config.llmProvider === "openai" ? config.openaiModel : "stub",
  });
}
