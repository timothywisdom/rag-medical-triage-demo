import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const agentPort = 4011;
const webPort = 3011;
const dataDir = resolve(process.cwd(), "take_home_starter");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    headless: true,
  },
  webServer: [
    {
      command: `npm run dev -w @maple/agent`,
      url: `http://127.0.0.1:${agentPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        LLM_PROVIDER: "stub",
        PORT: String(agentPort),
        HOST: "127.0.0.1",
        GROUNDING_CHECK: "0",
        DATA_DIR: dataDir,
      },
    },
    {
      command: `npm run dev -w @maple/web -- -p ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        AGENT_SERVICE_URL: `http://127.0.0.1:${agentPort}`,
        PORT: String(webPort),
      },
    },
  ],
});
