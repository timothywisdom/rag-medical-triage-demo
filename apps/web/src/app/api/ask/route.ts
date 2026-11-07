import { randomUUID } from "node:crypto";
import { webConfigFromEnv } from "../../../config";

const SAFE_UNAVAILABLE =
  "The triage service is unavailable. Please try again later. If this is an emergency, call 911 or go to the nearest emergency department.";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const question =
    typeof body === "object" &&
    body !== null &&
    "question" in body &&
    typeof (body as { question: unknown }).question === "string"
      ? (body as { question: string }).question.trim()
      : "";
  const summaryIds =
    typeof body === "object" &&
    body !== null &&
    "summaryIds" in body &&
    Array.isArray((body as { summaryIds: unknown }).summaryIds)
      ? (body as { summaryIds: unknown[] }).summaryIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [];

  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  const config = webConfigFromEnv(process.env);
  const requestId = randomUUID();

  try {
    const upstream = await fetch(`${config.agentServiceUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, question, summaryIds }),
      signal: AbortSignal.timeout(config.agentTimeoutMs),
    });

    const payload = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      return Response.json(payload, { status: upstream.status });
    }

    return Response.json({
      requestId: payload.requestId ?? requestId,
      instanceId: payload.instanceId,
      durationMs: payload.durationMs,
      result: payload.result,
    });
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
