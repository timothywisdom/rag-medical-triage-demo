import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadRepoEnvLocal, configFromEnv, repoRoot } from "@maple/agent";
import { loadEvalCases } from "./cases.js";
import { runEval } from "./runner.js";

async function main(): Promise<void> {
  loadRepoEnvLocal();
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      label: { type: "string", default: "run" },
      cases: { type: "string" },
      out: { type: "string" },
    },
  });

  const config = configFromEnv(process.env);
  let cases = loadEvalCases();
  if (values.cases) {
    const allow = new Set(values.cases.split(",").map((s) => s.trim()));
    cases = cases.filter((c) => allow.has(c.case_id));
  }

  const outDir = values.out ?? resolve(repoRoot(), "apps/eval/runs");
  const { jsonPath, mdPath } = await runEval({
    config,
    cases,
    outDir,
    label: values.label ?? "run",
  });
  process.stdout.write(`wrote ${jsonPath}\nwrote ${mdPath}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
