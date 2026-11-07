/**
 * Spec: Web handles input and calls the agentic portion over HTTP.
 * Feature: Web app forwards questions to the agent
 */
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { configFromEnv } from "../../apps/agent/src/config.js";
import { startAgentServer } from "../../apps/agent/src/server.js";
import { POST as askPost } from "../../apps/web/src/app/api/ask/route";
import { GET as patientsGet } from "../../apps/web/src/app/api/patients/route";

const dataDir = resolve(process.cwd(), "take_home_starter");

describe("Feature: Web app forwards questions to the agent", () => {
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (closers.length) {
      const close = closers.pop();
      await close?.();
    }
    delete process.env.AGENT_SERVICE_URL;
    delete process.env.AGENT_TIMEOUT_MS;
  });

  it("Scenario: Question is forwarded and the result is returned", async () => {
    const agent = await startAgentServer(
      configFromEnv({
        LLM_PROVIDER: "stub",
        PORT: "0",
        DATA_DIR: dataDir,
        AGENT_INSTANCE: "web-fwd",
      }),
    );
    closers.push(agent.close);
    process.env.AGENT_SERVICE_URL = agent.baseUrl;

    const res = await askPost(
      jsonRequest({
        question: "When can I go back to work?",
        summaryIds: ["strep_01"],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { action: string };
      instanceId: string;
    };
    expect(body.result.action).toBeTruthy();
    expect(body.instanceId).toBe("web-fwd");
  });

  it("Scenario: Web validates input before calling the agent", async () => {
    let hits = 0;
    const fake = createServer((_req, res) => {
      hits += 1;
      res.writeHead(200);
      res.end("{}");
    });
    await listen(fake);
    closers.push(
      () =>
        new Promise((resolvePromise, reject) => {
          fake.close((err) => (err ? reject(err) : resolvePromise()));
        }),
    );
    const { port } = fake.address() as AddressInfo;
    process.env.AGENT_SERVICE_URL = `http://127.0.0.1:${port}`;

    const res = await askPost(jsonRequest({ question: "", summaryIds: ["strep_01"] }));
    expect(res.status).toBe(400);
    expect(hits).toBe(0);
  });

  it("Scenario: Agent unavailable never produces a made-up answer", async () => {
    process.env.AGENT_SERVICE_URL = "http://127.0.0.1:1";
    const res = await askPost(
      jsonRequest({
        question: "When can I go back to work?",
        summaryIds: ["strep_01"],
      }),
    );
    expect(res.status).toBe(502);
    const body = (await res.json()) as {
      error: string;
      result?: unknown;
    };
    expect(body.error).toMatch(/unavailable/i);
    expect(body.error).toMatch(/911/);
    expect(body.result).toBeUndefined();
  });

  it("Scenario: Agent timeout", async () => {
    const hanging = createServer((_req, _res) => {
      /* never respond */
    });
    await listen(hanging);
    closers.push(
      () =>
        new Promise((resolvePromise, reject) => {
          hanging.close((err) => (err ? reject(err) : resolvePromise()));
        }),
    );
    const { port } = hanging.address() as AddressInfo;
    process.env.AGENT_SERVICE_URL = `http://127.0.0.1:${port}`;
    process.env.AGENT_TIMEOUT_MS = "50";

    const res = await askPost(
      jsonRequest({
        question: "When can I go back to work?",
        summaryIds: ["strep_01"],
      }),
    );
    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/911/);
  });

  it("Scenario: Patient list is proxied", async () => {
    const agent = await startAgentServer(
      configFromEnv({
        LLM_PROVIDER: "stub",
        PORT: "0",
        DATA_DIR: dataDir,
      }),
    );
    closers.push(agent.close);
    process.env.AGENT_SERVICE_URL = agent.baseUrl;

    const direct = await fetch(`${agent.baseUrl}/patients`);
    const expected = await direct.json();
    const res = await patientsGet();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expected);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });
}
