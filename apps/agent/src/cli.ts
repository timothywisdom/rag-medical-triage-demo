import { parseArgs } from "node:util";
import { loadRepoEnvLocal, configFromEnv } from "./config.js";
import { createTriageRunner } from "./run.js";

async function main(): Promise<void> {
  loadRepoEnvLocal();

  let values: {
    summary?: string[];
    help?: boolean;
  };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        summary: { type: "string", multiple: true, short: "s" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
    }));
  } catch {
    printUsage();
    process.exit(2);
  }

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const question = positionals.join(" ").trim();
  const summaryIds = values.summary ?? [];
  if (!question) {
    printUsage();
    process.exit(2);
  }

  const config = configFromEnv(process.env);
  const runner = createTriageRunner(config);
  const result = await runner.triage({ question, summaryIds });
  process.stdout.write(`${JSON.stringify(result.response)}\n`);
}

function printUsage(): void {
  process.stderr.write(
    "Usage: npm run ask -w @maple/agent -- --summary <id> [--summary <id> ...] <question>\n",
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
