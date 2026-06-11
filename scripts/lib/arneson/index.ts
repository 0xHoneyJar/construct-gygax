/**
 * index.ts — arneson real-play view CLI (cycle-009, Sprint 4; FR-5.1/5.2, S5; OQ-3 RESOLVED:
 * a script with --json, not prompt-side YAML — testable, hermetic, and the never-re-grade
 * invariant is enforceable by test only when reading is code).
 *
 *   npx tsx scripts/lib/arneson/index.ts [--root <dir>] [--json]
 *
 * Exit 0 even when no sibling resolves: absence is a state ({"root": null}), never an error.
 * Output discipline: report/JSON to stdout, nothing else (Nakamoto convention). All numbers
 * are verbatim from records — this module renders, it never grades.
 */
import { resolveArnesonRoot, validateRoot } from "./discover.ts";
import { loadPlayouts, type PlayoutRecord } from "./playouts.ts";

export interface ArnesonView {
  root: string | null;
  records: PlayoutRecord[];
  unreadable: number;
}

/** Resolve + load the sibling's playout history (root override > env > sibling probe). */
export function arnesonView(rootOverride?: string, env?: NodeJS.ProcessEnv): ArnesonView {
  const root = rootOverride !== undefined ? validateRoot(rootOverride) : resolveArnesonRoot(env);
  if (root === null) return { root: null, records: [], unreadable: 0 };
  const { records, unreadable } = loadPlayouts(root);
  return { root, records, unreadable };
}

const dash = (v: string | number | undefined | null): string => (v === undefined || v === null ? "—" : String(v));

function countsCell(counts?: Record<string, number>): string {
  if (!counts) return "—";
  return Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}

/** Render the Real-Play History view (deterministic; markdown). */
export function renderArnesonView(view: ArnesonView): string {
  const lines: string[] = [];
  if (view.root === null) {
    lines.push("No Arneson sibling found (GYGAX_ARNESON_ROOT unset and ../construct-arneson absent).");
    return lines.join("\n");
  }
  lines.push(`## Real-Play History (read-only, from ${view.root})`);
  lines.push("");
  lines.push("_Numbers below are read verbatim from Arneson playout records — Gygax renders, it never re-grades._");
  lines.push("");
  if (view.records.length === 0) {
    lines.push("No playout records yet.");
  } else {
    lines.push("| playout | kind | lane | scenario | counts / configs | validation | completed |");
    lines.push("|---------|------|------|----------|------------------|------------|-----------|");
    for (const r of view.records) {
      const detail =
        r.kind === "sweep" && r.configs
          ? r.configs
              .map((c) => `${dash(c.name)}: ${countsCell(c.triage)} cliff=${dash(c.cliffRung)} ${dash(c.severity)}`)
              .join("; ")
          : countsCell(r.counts);
      lines.push(
        `| ${r.playoutId} | ${r.kind} | ${dash(r.lane)} | ${dash(r.scenarioId)} | ${detail} | ` +
          `${dash(r.validation)} | ${dash(r.completedAt)} |`,
      );
    }
  }
  if (view.unreadable > 0) {
    lines.push("");
    lines.push(`(${view.unreadable} unreadable/malformed record file${view.unreadable === 1 ? "" : "s"} skipped)`);
  }
  return lines.join("\n");
}

// CLI
if (process.argv[1]?.endsWith("index.ts") && process.argv[1]?.includes("arneson")) {
  const args = process.argv.slice(2);
  let rootOverride: string | undefined;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") rootOverride = args[++i];
    else if (args[i] === "--json") json = true;
    else {
      process.stderr.write(`unknown flag: ${args[i]}\nusage: index.ts [--root <dir>] [--json]\n`);
      process.exit(2);
    }
  }
  const view = arnesonView(rootOverride);
  process.stdout.write(json ? JSON.stringify(view) + "\n" : renderArnesonView(view) + "\n");
}
