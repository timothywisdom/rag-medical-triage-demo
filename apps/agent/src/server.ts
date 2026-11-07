import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AgentConfig } from "./config.js";
import { createTriageRunner } from "./run.js";

export type RunningAgentServer = {
  baseUrl: string;
  port: number;
  close: () => Promise<void>;
};

const TriageRequestSchema = z.object({
  requestId: z.string().min(1).optional(),
  question: z.string().min(1),
  summaryIds: z.array(z.string()).default([]),
});

export async function startAgentServer(
  config: AgentConfig,
): Promise<RunningAgentServer> {
  const runner = createTriageRunner(config);
  const server = createServer((req, res) => {
    void handle(req, res, config, runner);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://${config.host}:${address.port}`,
    port: address.port,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  config: AgentConfig,
  runner: ReturnType<typeof createTriageRunner>,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, {
        ok: true,
        instanceId: config.instanceId,
        llmProvider: config.llmProvider,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/patients") {
      const patients = runner.store.listPatients().map((p) => ({
        id: p.patientId,
        displayName: p.displayName,
        summaryIds: p.summaryIds,
      }));
      send(res, 200, patients);
      return;
    }

    if (req.method === "POST" && url.pathname === "/triage") {
      await triage(req, res, config, runner);
      return;
    }

    send(res, 404, { error: "Not found." });
  } catch (error) {
    send(res, 500, {
      error: error instanceof Error ? error.message : "Internal error.",
    });
  }
}

async function triage(
  req: IncomingMessage,
  res: ServerResponse,
  config: AgentConfig,
  runner: ReturnType<typeof createTriageRunner>,
): Promise<void> {
  const started = Date.now();
  let raw: unknown;
  try {
    raw = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, { error: "Request body must be JSON." });
    return;
  }

  const parsed = TriageRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".") || "body");
    send(res, 400, {
      error: `Invalid request: ${names.join(", ")}`,
    });
    return;
  }

  const requestId = parsed.data.requestId ?? randomUUID();
  const result = await runner.triage({
    question: parsed.data.question,
    summaryIds: parsed.data.summaryIds,
  });

  send(res, 200, {
    requestId,
    instanceId: config.instanceId,
    durationMs: Date.now() - started,
    result: result.response,
    trace: result.trace,
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
