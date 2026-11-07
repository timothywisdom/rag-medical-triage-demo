import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareRuns, type EvalRunLog } from "./runner.js";

function main(): void {
  const [beforePath, afterPath, outPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    process.stderr.write(
      "Usage: npm run eval:compare -- <before.json> <after.json> [out.md]\n",
    );
    process.exit(2);
  }
  const before = JSON.parse(readFileSync(beforePath, "utf8")) as EvalRunLog;
  const after = JSON.parse(readFileSync(afterPath, "utf8")) as EvalRunLog;
  const report = compareRuns(before, after);
  process.stdout.write(report);
  if (outPath) {
    writeFileSync(resolve(outPath), report);
  }
}

main();
