import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { compareRuns, type EvalRunLog } from "./runner.js";

function resolveFromCwd(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function main(): void {
  const [beforePath, afterPath, outPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    process.stderr.write(
      "Usage: npm run eval:compare -- <before.json> <after.json> [out.md]\n",
    );
    process.exit(2);
  }
  // npm -w runs with cwd=apps/eval; also accept paths from the repo root.
  const beforeFile = [resolveFromCwd(beforePath), resolve(process.cwd(), "..", "..", beforePath)]
    .find((p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });
  const afterFile = [resolveFromCwd(afterPath), resolve(process.cwd(), "..", "..", afterPath)]
    .find((p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });
  if (!beforeFile || !afterFile) {
    throw new Error("Could not open one of the run log paths.");
  }
  const before = JSON.parse(readFileSync(beforeFile, "utf8")) as EvalRunLog;
  const after = JSON.parse(readFileSync(afterFile, "utf8")) as EvalRunLog;
  const report = compareRuns(before, after);
  process.stdout.write(report);
  if (outPath) {
    const outFile = isAbsolute(outPath)
      ? outPath
      : resolve(process.cwd(), "..", "..", outPath);
    writeFileSync(outFile, report);
  }
}

main();
