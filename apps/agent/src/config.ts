import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AgentConfig = {
  host: string;
  port: number;
  llmProvider: "stub" | "openai";
  openaiApiKey?: string;
  openaiModel: string;
  groundingCheck: boolean;
  groundingMaxRetries: number;
  promptVersion: "v1" | "v2" | "v3";
  maxLlmAttempts: number;
  retryBaseMs: number;
  instanceId: string;
  dataDir: string;
};

export function configFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AgentConfig {
  const llmProvider = (env.LLM_PROVIDER || "stub").trim();
  if (llmProvider !== "stub" && llmProvider !== "openai") {
    throw new Error('LLM_PROVIDER must be "stub" or "openai".');
  }

  const openaiApiKey = env.OPEN_AI_API_KEY?.trim() || undefined;
  if (llmProvider === "openai" && !openaiApiKey) {
    throw new Error(
      "OPEN_AI_API_KEY is required when LLM_PROVIDER is openai.",
    );
  }

  const promptVersion = (env.PROMPT_VERSION || "v1").trim();
  if (
    promptVersion !== "v1" &&
    promptVersion !== "v2" &&
    promptVersion !== "v3"
  ) {
    throw new Error('PROMPT_VERSION must be "v1", "v2", or "v3".');
  }

  const groundingMaxRetries = intEnv(env, "GROUNDING_MAX_RETRIES", 2);
  if (groundingMaxRetries < 0 || groundingMaxRetries > 3) {
    throw new Error("GROUNDING_MAX_RETRIES must be from 0 to 3.");
  }

  const maxLlmAttempts = intEnv(env, "LLM_MAX_ATTEMPTS", 3);
  if (maxLlmAttempts < 1 || maxLlmAttempts > 5) {
    throw new Error("LLM_MAX_ATTEMPTS must be from 1 to 5.");
  }

  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port: intEnv(env, "PORT", 4001),
    llmProvider,
    openaiApiKey,
    openaiModel: (env.OPENAI_MODEL || "gpt-4o-mini").trim(),
    groundingCheck: env.GROUNDING_CHECK !== "0",
    groundingMaxRetries,
    promptVersion,
    maxLlmAttempts,
    retryBaseMs: intEnv(env, "LLM_RETRY_BASE_MS", 200),
    instanceId: env.AGENT_INSTANCE?.trim() || `agent-${process.pid}`,
    dataDir: env.DATA_DIR?.trim() || defaultDataDir(),
  };
}

/** Repo root (apps/agent/src -> ../../..). */
export function repoRoot(): string {
  return resolve(fileURLToPath(new URL("../../..", import.meta.url)));
}

/** Load KEY=VALUE pairs from a .env file into process.env (does not override). */
export function loadEnvFile(filePath = ".env.local"): void {
  const absolute = resolve(filePath);
  if (!existsSync(absolute)) return;
  const text = readFileSync(absolute, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Load the repo-root `.env.local` (cwd-independent). */
export function loadRepoEnvLocal(): void {
  loadEnvFile(resolve(repoRoot(), ".env.local"));
}

function defaultDataDir(): string {
  return resolve(repoRoot(), "take_home_starter");
}

function intEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  return value;
}
