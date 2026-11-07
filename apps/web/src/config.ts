export type WebConfig = {
  agentServiceUrl: string;
  agentTimeoutMs: number;
};

export function webConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WebConfig {
  const raw = (env.AGENT_SERVICE_URL || "http://127.0.0.1:4001").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("AGENT_SERVICE_URL must be an http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("AGENT_SERVICE_URL must be an http(s) URL.");
  }

  const agentTimeoutMs = intEnv(env, "AGENT_TIMEOUT_MS", 30_000);
  if (agentTimeoutMs < 1 || agentTimeoutMs > 120_000) {
    throw new Error("AGENT_TIMEOUT_MS must be from 1 to 120000.");
  }

  return {
    agentServiceUrl: url.origin,
    agentTimeoutMs,
  };
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
