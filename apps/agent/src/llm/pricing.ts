/** USD per 1M tokens. Update when model pricing changes. */
const PRICING_PER_MTOK: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export function estimateCostUsd(
  model: string,
  usage: TokenUsage | undefined,
): number | undefined {
  if (!usage) return undefined;
  const rates = PRICING_PER_MTOK[model] ?? PRICING_PER_MTOK["gpt-4o-mini"]!;
  const cost =
    (usage.inputTokens / 1_000_000) * rates.input +
    (usage.outputTokens / 1_000_000) * rates.output;
  return roundUsd(cost);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
