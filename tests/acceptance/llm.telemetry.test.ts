/**
 * Feature: LLM call telemetry (OTEL + console) for cost and latency
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import { loadSummaryStore } from "../../apps/agent/src/store.js";
import { LlmService } from "../../apps/agent/src/llm/service.js";
import { StubProvider } from "../../apps/agent/src/llm/stub.js";
import { estimateCostUsd } from "../../apps/agent/src/llm/pricing.js";
import type { LlmProvider, GenerateInput } from "../../apps/agent/src/llm/types.js";
import type { TokenUsage } from "../../apps/agent/src/llm/pricing.js";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: LLM call telemetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Scenario: Service logs latency and cost for each generate call", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    const store = loadSummaryStore(dataDir);
    const service = new LlmService(new StubProvider(), {
      maxAttempts: 1,
      retryBaseMs: 1,
      providerName: "stub",
      model: "stub",
    });

    await service.generate({
      question: "When can I go back to work?",
      summaries: [store.get("strep_01")!],
    });

    const eventLine = logs.find((line) => line.startsWith("[maple.llm] "));
    expect(eventLine).toBeTruthy();
    const event = JSON.parse(eventLine!.slice("[maple.llm] ".length)) as {
      operation: string;
      provider: string;
      model: string;
      latencyMs: number;
      costUsd: number;
      success: boolean;
      usage?: TokenUsage;
    };
    expect(event.operation).toBe("generate");
    expect(event.provider).toBe("stub");
    expect(event.model).toBe("stub");
    expect(event.success).toBe(true);
    expect(event.costUsd).toBe(0);
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    expect(event.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  it("Scenario: Cost is estimated from OpenAI token usage and model rates", () => {
    const cost = estimateCostUsd("gpt-4o-mini", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    // $0.15 / 1M input + $0.60 / 1M output
    expect(cost).toBe(0.75);
  });

  it("Scenario: Failed calls still emit latency telemetry", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    const failing: LlmProvider = {
      async generate(_input: GenerateInput) {
        throw new Error("boom");
      },
      async judge() {
        return { supported: true, unsupportedClaims: [] };
      },
      takeLastUsage() {
        return undefined;
      },
    };

    const service = new LlmService(failing, {
      maxAttempts: 1,
      retryBaseMs: 1,
      providerName: "openai",
      model: "gpt-4o-mini",
    });

    await expect(
      service.generate({
        question: "q",
        summaries: [
          {
            summaryId: "x",
            patientId: "p",
            displayName: "P",
            visitDate: "2026-01-01",
            text: "Plan:\n- drink water",
          },
        ],
      }),
    ).rejects.toThrow(/boom/);

    const eventLine = logs.find((line) => line.startsWith("[maple.llm] "));
    expect(eventLine).toBeTruthy();
    const event = JSON.parse(eventLine!.slice("[maple.llm] ".length)) as {
      success: boolean;
      error?: string;
      latencyMs: number;
    };
    expect(event.success).toBe(false);
    expect(event.error).toMatch(/boom/);
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
