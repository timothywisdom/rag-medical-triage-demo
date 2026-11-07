import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, configFromEnv } from "./config.js";
import { startAgentServer } from "./server.js";

async function main(): Promise<void> {
  const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
  loadEnvFile(resolve(repoRoot, ".env.local"));
  loadEnvFile(".env.local");
  const config = configFromEnv(process.env);
  const server = await startAgentServer(config);
  process.stdout.write(
    `Maple agent listening on ${server.baseUrl} (instance ${config.instanceId}, provider ${config.llmProvider})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
