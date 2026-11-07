export type WebConfig = {
  agentServiceUrl: string;
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

  return {
    agentServiceUrl: url.origin,
  };
}
