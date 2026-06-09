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

export type { IncentiveAnalysis } from "./report.ts";

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

// CLI: `npx tsx scripts/lib/payoff/index.ts <incentiveStateDir>`
if (process.argv[1]?.endsWith("index.ts") && process.argv[1]?.includes("payoff")) {
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
