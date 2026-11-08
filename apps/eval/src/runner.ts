import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTriageRunner,
  type AgentConfig,
} from "@maple/agent";
import type { EvalCase } from "./cases.js";
import { scoreCase, summarize, type CaseScore, type ScoreSummary } from "./score.js";

export type EvalRunLog = {
  label: string;
  timestamp: string;
  config: {
    llmProvider: string;
    promptVersion: string;
    groundingCheck: boolean;
    groundingMaxRetries: number;
    openaiModel: string;
  };
  results: Array<
    CaseScore & {
      question: string;
      expected_action: string;
      expected_urgency: string;
      actual_action?: string;
      actual_urgency?: string;
      reply?: string;
      reason?: string;
      trace?: unknown;
    }
  >;
  metrics: ScoreSummary;
};

export async function runEval(options: {
  config: AgentConfig;
  cases: EvalCase[];
  outDir: string;
  label: string;
}): Promise<{ jsonPath: string; mdPath: string; log: EvalRunLog }> {
  const runner = createTriageRunner(options.config);
  const scored: EvalRunLog["results"] = [];

  for (const evalCase of options.cases) {
    const triage = await runner.triage({
      question: evalCase.question,
      summaryIds: evalCase.summary_ids,
    });
    const groundingFailed =
      triage.trace.groundingFailures.length > 0 &&
      triage.response.action === "escalate" &&
      /grounding/i.test(triage.response.reason);
    const base = scoreCase(evalCase, triage.response, { groundingFailed });
    scored.push({
      ...base,
      question: evalCase.question,
      expected_action: evalCase.expected_action,
      expected_urgency: evalCase.expected_urgency,
      actual_action: triage.response.action,
      actual_urgency: triage.response.urgency,
      reply: triage.response.reply,
      reason: triage.response.reason,
      trace: triage.trace,
    });
  }

  const metrics = summarize(scored);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const log: EvalRunLog = {
    label: options.label,
    timestamp,
    config: {
      llmProvider: options.config.llmProvider,
      promptVersion: options.config.promptVersion,
      groundingCheck: options.config.groundingCheck,
      groundingMaxRetries: options.config.groundingMaxRetries,
      openaiModel: options.config.openaiModel,
    },
    results: scored,
    metrics,
  };

  mkdirSync(options.outDir, { recursive: true });
  const stem = `${timestamp}-${options.label}`;
  const jsonPath = join(options.outDir, `${stem}.json`);
  const mdPath = join(options.outDir, `${stem}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(log, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(log));

  process.stdout.write(
    `accuracy=${metrics.accuracy.toFixed(3)} underTriage=${metrics.underTriageRate.toFixed(3)} emergencyRecall=${metrics.emergencyRecall ?? "n/a"}\n`,
  );

  return { jsonPath, mdPath, log };
}

export function compareRuns(
  before: {
    label: string;
    results: Array<{ caseId: string; correct: boolean }>;
    metrics: {
      accuracy: number;
      underTriageRate: number;
      emergencyRecall: number | null;
    };
  },
  after: {
    label: string;
    results: Array<{ caseId: string; correct: boolean }>;
    metrics: {
      accuracy: number;
      underTriageRate: number;
      emergencyRecall: number | null;
    };
  },
): string {
  const beforeMap = new Map(before.results.map((r) => [r.caseId, r.correct]));
  const flipped: string[] = [];
  for (const row of after.results) {
    const prev = beforeMap.get(row.caseId);
    if (prev === undefined || prev === row.correct) continue;
    flipped.push(
      `${row.caseId}: ${prev ? "correct" : "incorrect"} → ${row.correct ? "correct" : "incorrect"}`,
    );
  }

  return [
    `# Compare ${before.label} → ${after.label}`,
    "",
    `| metric | before | after | delta |`,
    `|---|---:|---:|---:|`,
    row("accuracy", before.metrics.accuracy, after.metrics.accuracy),
    row(
      "underTriageRate",
      before.metrics.underTriageRate,
      after.metrics.underTriageRate,
    ),
    row(
      "emergencyRecall",
      before.metrics.emergencyRecall ?? 0,
      after.metrics.emergencyRecall ?? 0,
    ),
    "",
    "## Flipped cases",
    flipped.length ? flipped.map((f) => `- ${f}`).join("\n") : "- none",
    "",
  ].join("\n");
}

function row(name: string, before: number, after: number): string {
  const delta = after - before;
  return `| ${name} | ${before.toFixed(3)} | ${after.toFixed(3)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(3)} |`;
}

function renderMarkdown(log: EvalRunLog): string {
  const failing = log.results.filter((r) => !r.correct);
  return [
    `# Eval run ${log.label}`,
    "",
    `- timestamp: ${log.timestamp}`,
    `- provider: ${log.config.llmProvider}`,
    `- prompt: ${log.config.promptVersion}`,
    `- grounding: ${log.config.groundingCheck}`,
    "",
    "## Metrics",
    "",
    `| metric | value |`,
    `|---|---:|`,
    `| accuracy | ${log.metrics.accuracy.toFixed(3)} |`,
    `| underTriageRate | ${log.metrics.underTriageRate.toFixed(3)} |`,
    `| overTriageRate | ${log.metrics.overTriageRate.toFixed(3)} |`,
    `| emergencyRecall | ${log.metrics.emergencyRecall ?? "n/a"} |`,
    "",
    "## Failing cases",
    "",
    failing.length === 0
      ? "- none"
      : failing
          .map(
            (f) =>
              `- ${f.caseId}: expected ${f.expected_action}/${f.expected_urgency}, got ${f.actual_action}/${f.actual_urgency}`,
          )
          .join("\n"),
    "",
  ].join("\n");
}
