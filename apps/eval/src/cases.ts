import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type EvalCase = {
  case_id: string;
  summary_ids: string[];
  question: string;
  expected_action: "answer" | "escalate";
  expected_urgency: "routine" | "urgent" | "emergency";
  notes: string;
  must_match?: string[];
  must_not_match?: string[];
};

type ProvidedRow = {
  case_id: string;
  summary_id: string;
  question: string;
  expected_action: "answer" | "escalate";
  expected_urgency: "routine" | "urgent" | "emergency";
  notes: string;
};

type CustomRow = {
  case_id: string;
  summary_ids: string[];
  question: string;
  expected_action: "answer" | "escalate";
  expected_urgency: "routine" | "urgent" | "emergency";
  notes: string;
};

type ReplyChecks = Record<
  string,
  { must_match?: string[]; must_not_match?: string[] }
>;

export function loadEvalCases(options?: {
  providedPath?: string;
  customPath?: string;
  replyChecksPath?: string;
}): EvalCase[] {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const providedPath =
    options?.providedPath ??
    resolve(root, "take_home_starter/cases.jsonl");
  const customPath =
    options?.customPath ?? resolve(root, "apps/eval/cases.custom.jsonl");
  const replyChecksPath =
    options?.replyChecksPath ?? resolve(root, "apps/eval/reply_checks.json");

  const provided = readJsonl<ProvidedRow>(providedPath).map((row) => ({
    case_id: row.case_id,
    summary_ids: [row.summary_id],
    question: row.question,
    expected_action: row.expected_action,
    expected_urgency: row.expected_urgency,
    notes: row.notes,
  }));
  const custom = readJsonl<CustomRow>(customPath);
  const checks = JSON.parse(
    readFileSync(replyChecksPath, "utf8"),
  ) as ReplyChecks;

  return [...provided, ...custom].map((c) => ({
    ...c,
    must_match: checks[c.case_id]?.must_match,
    must_not_match: checks[c.case_id]?.must_not_match,
  }));
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
