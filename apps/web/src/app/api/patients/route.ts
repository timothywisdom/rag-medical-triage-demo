import { webConfigFromEnv } from "../../../config.js";

const SAFE_UNAVAILABLE =
  "The triage service is unavailable. Please try again later. If this is an emergency, call 911 or go to the nearest emergency department.";

export async function GET(): Promise<Response> {
  const config = webConfigFromEnv(process.env);
  try {
    const upstream = await fetch(`${config.agentServiceUrl}/patients`, {
      signal: AbortSignal.timeout(config.agentTimeoutMs),
    });
    const payload = await upstream.json();
    return Response.json(payload, { status: upstream.status });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json(
      { error: SAFE_UNAVAILABLE },
      { status: timedOut ? 504 : 502 },
    );
  }
}
