/**
 * Spec: TypeScript/Node; grounding and LLM provider via app-level config.
 * Feature: App-level configuration
 */
import { describe, expect, it } from "vitest";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { webConfigFromEnv } from "../../apps/web/src/config.js";

describe("Feature: App-level configuration", () => {
  it('Scenario: Defaults are safe and offline', () => {
    const config = configFromEnv({});

    expect(config).toMatchObject({
      llmProvider: "stub",
      groundingCheck: true,
      groundingMaxRetries: 2,
      promptVersion: "v1",
      openaiModel: "gpt-4o-mini",
    });
  });

  it("Scenario: OpenAI provider requires a key", () => {
    expect(() => configFromEnv({ LLM_PROVIDER: "openai" })).toThrow(
      /OPEN_AI_API_KEY/,
    );
  });

  it("Scenario: Invalid values are rejected", () => {
    expect(() =>
      configFromEnv({ GROUNDING_MAX_RETRIES: "9" }),
    ).toThrow(/GROUNDING_MAX_RETRIES/);
  });

  it("Scenario: Agent service listens on its own port", () => {
    const config = configFromEnv({});
    expect(config).toMatchObject({
      host: "127.0.0.1",
      port: 4001,
    });
  });

  it("Scenario: Web config only knows where the agent is", () => {
    const web = webConfigFromEnv({});
    expect(web).toEqual({
      agentServiceUrl: "http://127.0.0.1:4001",
      agentTimeoutMs: 30_000,
    });
    expect(web).not.toHaveProperty("llmProvider");
    expect(web).not.toHaveProperty("openaiApiKey");
    expect(web).not.toHaveProperty("openaiModel");
  });

  it("Scenario: GROUNDING_CHECK=0 disables grounding", () => {
    const config = configFromEnv({ GROUNDING_CHECK: "0" });
    expect(config.groundingCheck).toBe(false);
  });

  it("Scenario: Non-http AGENT_SERVICE_URL is rejected", () => {
    expect(() =>
      webConfigFromEnv({ AGENT_SERVICE_URL: "ftp://localhost" }),
    ).toThrow(/AGENT_SERVICE_URL/);
  });
});
