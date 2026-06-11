/**
 * index.ts — incentive-analysis orchestration + public surface (cycle-006, Sprint 1).
 *
 * Loads an incentive-state (actions with payoff formulas + a reward with first-class intent),
 * builds the payoff matrix, runs dominance/argmax detection, renders a forecast-tagged report.
 * Mirrors the cycle-005 parametric module shape. YAML via `yq` (repo convention).
 */
import { readFileSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { buildMatrix, IncentiveError, type IncentiveState, type ActionPayoff, type PayoffMatrix } from "./matrix.ts";
import { analyzeDominance, type DominanceResult } from "./dominance.ts";
import { analyzeGoodhart } from "./goodhart.ts";
import { renderIncentiveReport, type IncentiveAnalysis } from "./report.ts";
import { checkDominance, type DominanceCheck } from "./check-dominance.ts";

export type { IncentiveAnalysis } from "./report.ts";
export { checkDominance, type DominanceCheck, type DominanceVerdict } from "./check-dominance.ts";

function loadYaml(file: string): any {
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  try {
    return JSON.parse(execFileSync("yq", ["-o=json", ".", file], { encoding: "utf8" }));
  } catch (e) {
    throw new IncentiveError(`failed to parse ${file} via yq: ${(e as Error).message}`);
  }
}

/** Load an incentive-state from a directory containing index.yaml + actions/ + reward/. */
export function loadIncentiveState(incentiveStateDir: string): IncentiveState {
  const indexPath = join(incentiveStateDir, "index.yaml");
  const idx = loadYaml(indexPath) as Record<string, any>;
  const resolve = (rel: string) => (isAbsolute(rel) ? rel : join(incentiveStateDir, rel));

  const ctx = idx.context ?? {};
  const context: string = ctx.name;
  const domain = { min: Number(ctx.domain?.min), max: Number(ctx.domain?.max) };
  if (!context) throw new IncentiveError("index.yaml missing context.name");

  const actions: ActionPayoff[] = [];
  for (const rel of idx.actions ?? []) {
    const doc = loadYaml(resolve(rel)) as Record<string, any>;
    const p = doc.payoff ?? {};
    if (typeof doc.id !== "string" || typeof p.reward !== "string" || typeof p.cost !== "string") {
      throw new IncentiveError(`action ${rel} needs id + payoff.reward + payoff.cost`);
    }
    actions.push({
      id: doc.id,
      tunability: doc.tunability === "engine-default" || doc.tunability === "structural" ? doc.tunability : undefined,
      reward: p.reward,
      cost: p.cost,
    });
  }

  let intendedAction: string | undefined;
  let nonNegotiable: boolean | undefined;
  let rewardId: string | undefined;
  if (idx.reward_signal) {
    const r = loadYaml(resolve(idx.reward_signal)) as Record<string, any>;
    rewardId = r.id;
    intendedAction = r.intent?.intended_action;
    nonNegotiable = r.intent?.non_negotiable;
  }

  return { context, domain, actions, intendedAction, nonNegotiable, rewardId };
}

export function analyzeIncentives(incentiveStateDir: string): IncentiveAnalysis {
  const state = loadIncentiveState(incentiveStateDir);
  const matrix: PayoffMatrix = buildMatrix(state);
  const dominance: DominanceResult = analyzeDominance(matrix, state.intendedAction);
  const goodhart = analyzeGoodhart(matrix, dominance);
  return { matrix, dominance, goodhart };
}

// ---- check-dominance subcommand (cycle-009, Sprint 3; FR-2.1, sdd §5.1) ----------------------

const CHECK_DOMINANCE_HELP = `usage: index.ts check-dominance --incentive-state <dir> [--json]

Computes whether any non-intended action's net payoff reaches the intended
action's net somewhere in the declared context domain (the forecast authority's
callable surface — the same matrix.ts nets the incentive report uses).

verdicts (ALL THREE exit 0 — a verdict is a property of the input, not a failure):
  hack-dominates   some non-intended action's net >= the intended action's net
                   at some integer context step (EPS = 1e-9 tolerance)
  no-dominance     no non-intended action's net reaches the intended action's
                   net at any integer context step
  indeterminate    no intent.intended_action declared, or no candidate hacks

exit codes (warn-not-reject parity with Arneson's check_payoff_dominance.py, NFR-5):
  0  verdict computed (any of the three)
  1  unparseable/invalid incentive-state (IncentiveError)
  2  usage error

sampling difference (documented, not hidden — sdd §5.1): Gygax evaluates INTEGER
steps of the context domain (matrix.ts steps()); Arneson's checker samples 50
evenly spaced points across the same domain. A hack dominant only between integer
points could make the two diverge — cross-implementation conformance is therefore
verdict-level on the dungeon fixture. Exit-code nuance: Arneson exits 1 on a
missing intent; Gygax returns 'indeterminate' with exit 0 (their shell can map it).
`;

function fmtNet(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function renderDominanceCheck(check: DominanceCheck, analysis: IncentiveAnalysis): string {
  const m = analysis.matrix;
  if (check.verdict === "hack-dominates") {
    const p = check.point!;
    return (
      `hack-dominates: '${p.action}' net ${fmtNet(p.net)} >= intended '${check.intendedAction}' ` +
      `net ${fmtNet(p.intendedNet)} at ${m.context}=${p.context}`
    );
  }
  if (check.verdict === "no-dominance") {
    return (
      `no-dominance: no non-intended action's net reaches intended '${check.intendedAction}' net ` +
      `at any integer ${m.context} step in ${m.domain.min}..${m.domain.max}`
    );
  }
  return `indeterminate: ${check.reason}`;
}

function runCheckDominanceCli(args: string[]): never {
  let dir: string | undefined;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--incentive-state") dir = args[++i];
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--help" || args[i] === "-h") {
      process.stdout.write(CHECK_DOMINANCE_HELP);
      process.exit(0);
    } else {
      process.stderr.write(`unexpected argument: ${args[i]}\n${CHECK_DOMINANCE_HELP}`);
      process.exit(2);
    }
  }
  if (!dir) {
    process.stderr.write(CHECK_DOMINANCE_HELP);
    process.exit(2);
  }
  let analysis: IncentiveAnalysis;
  try {
    analysis = analyzeIncentives(dir);
  } catch (e) {
    if (e instanceof IncentiveError) {
      process.stderr.write(`IncentiveError: ${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }
  const check = checkDominance(analysis);
  process.stdout.write(json ? JSON.stringify(check) + "\n" : renderDominanceCheck(check, analysis) + "\n");
  process.exit(0); // all three verdicts exit 0 — warn-not-reject (sdd §5.1/§6)
}

// CLI: `npx tsx scripts/lib/payoff/index.ts <incentiveStateDir>`
//   or: `npx tsx scripts/lib/payoff/index.ts check-dominance --incentive-state <dir> [--json]`
// The legacy positional form below is byte-untouched (NFR-6).
if (process.argv[1]?.endsWith("index.ts") && process.argv[1]?.includes("payoff")) {
  if (process.argv[2] === "check-dominance") {
    runCheckDominanceCli(process.argv.slice(3));
  } else {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write("usage: index.ts <incentiveStateDir>\n");
    process.exit(2);
  }
  const analysis = analyzeIncentives(dir);
  process.stdout.write(renderIncentiveReport(analysis) + "\n");
  const d = analysis.dominance;
  process.stdout.write(
    `dominant=${d.dominant ?? "none"} dominated=${d.dominated.length} intended_optimal=${d.intendedActionEverOptimal ?? "n/a"}\n`,
  );
  }
}
