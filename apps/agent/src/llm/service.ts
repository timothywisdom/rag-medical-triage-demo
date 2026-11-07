import type { TriageResponse } from "../contract.js";
import type {
  GenerateInput,
  JudgeInput,
  JudgeVerdict,
  LlmProvider,
  LlmServiceOptions,
} from "./types.js";
import { isRetryable } from "./types.js";

export class LlmService implements LlmProvider {
  constructor(
    private readonly provider: LlmProvider,
    private readonly options: LlmServiceOptions,
  ) {}

  generate(input: GenerateInput): Promise<TriageResponse> {
    return this.withRetry(() => this.provider.generate(input));
  }

  judge(input: JudgeInput): Promise<JudgeVerdict> {
    return this.withRetry(() => this.provider.judge(input));
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const { maxAttempts, retryBaseMs } = this.options;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !isRetryable(error)) break;
        const delay = retryBaseMs * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}
