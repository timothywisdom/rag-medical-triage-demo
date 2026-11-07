/**
 * Spec: Feature as CLI.
 * Feature: Agent CLI
 */
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { TriageResponseSchema } from "../../apps/agent/src/contract.js";

function runCli(args: string[]): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolvePromise) => {
    const child = spawn(
      "npx",
      ["tsx", "apps/agent/src/cli.ts", ...args],
      {
        cwd: resolve(process.cwd()),
        env: {
          ...process.env,
          LLM_PROVIDER: "stub",
          DATA_DIR: resolve(process.cwd(), "take_home_starter"),
        },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

describe("Feature: Agent CLI", () => {
  it("Scenario: Ask from the command line", async () => {
    const { code, stdout } = await runCli([
      "--summary",
      "strep_01",
      "When can I go back to work?",
    ]);
    expect(code).toBe(0);
    const json = JSON.parse(stdout.trim());
    expect(TriageResponseSchema.safeParse(json).success).toBe(true);
  }, 30_000);

  it("Scenario: Missing arguments", async () => {
    const { code, stderr } = await runCli([]);
    expect(code).toBe(2);
    expect(stderr).toMatch(/usage/i);
  }, 30_000);
});
