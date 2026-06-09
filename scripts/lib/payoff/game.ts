/**
 * game.ts — multi-agent coordination analysis (cycle-006, Sprint 3).
 *
 * A symmetric 2-player matrix game (the prisoner's-dilemma shape): detect each agent's dominant
 * strategy, the dominant-strategy equilibrium, and whether it diverges from the intended joint
 * action — a coordination failure — plus the price of anarchy. The agent-infra case where individual
 * rewards drive defection even though cooperation is better for everyone.
 *
 * Forecast-tagged (agent-incentive-analysis.md §9). YAML via `yq`. MVP: symmetric 2-player,
 * dominant-strategy-solvable (PD). Mixed-strategy `M⁻¹p` equilibrium (no-dominant / RPS) is a follow-up.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const EPS = 1e-9;

export interface Game {
  players: string[];
  actions: string[];
  payoff: Record<string, Record<string, number>>; // payoff[myAction][theirAction] = my payoff (symmetric)
  intendedJoint?: string[];
}

export interface GameAnalysis {
  dominant: string | null; // each agent's strictly-dominant action, if any
  equilibrium: [string, string] | null;
  equilibriumPayoff: number | null;
  intendedJoint?: string[];
  intendedPayoff?: number;
  coordinationFailure: boolean;
  priceOfAnarchy?: number; // intendedPayoff / equilibriumPayoff
  valueLeftOnTable?: number; // intendedPayoff − equilibriumPayoff (per agent)
}

export function loadGame(incentiveStateDir: string): Game {
  const idxPath = join(incentiveStateDir, "index.yaml");
  const idx = JSON.parse(execFileSync("yq", ["-o=json", ".", idxPath], { encoding: "utf8" })) as Record<string, any>;
  const players: string[] = idx.players ?? [];
  const actions: string[] = idx.actions ?? [];
  const payoff = idx.payoff_matrix ?? {};
  if (players.length !== 2) throw new Error("game.ts MVP supports symmetric 2-player games only");
  if (actions.length < 2) throw new Error("a game needs at least 2 actions");
  return { players, actions, payoff, intendedJoint: idx.intent?.intended_joint_action };
}

/** Strictly-dominant action: strictly best against every opponent action. */
export function dominantStrategy(g: Game): string | null {
  for (const a of g.actions) {
    const strictlyBest = g.actions.every((o) =>
      g.actions.every((b) => b === a || g.payoff[a][o] > g.payoff[b][o] + EPS),
    );
    if (strictlyBest) return a;
  }
  return null;
}

export function analyzeGame(g: Game): GameAnalysis {
  const dominant = dominantStrategy(g);
  const equilibrium: [string, string] | null = dominant ? [dominant, dominant] : null;
  const equilibriumPayoff = dominant ? g.payoff[dominant][dominant] : null;

  const result: GameAnalysis = { dominant, equilibrium, equilibriumPayoff, coordinationFailure: false };

  if (g.intendedJoint && g.intendedJoint.length === 2) {
    result.intendedJoint = g.intendedJoint;
    const [ia, ib] = g.intendedJoint;
    result.intendedPayoff = g.payoff[ia]?.[ib];
    if (equilibrium) {
      result.coordinationFailure = equilibrium[0] !== ia || equilibrium[1] !== ib;
      if (result.coordinationFailure && equilibriumPayoff && result.intendedPayoff != null) {
        result.priceOfAnarchy = result.intendedPayoff / equilibriumPayoff;
        result.valueLeftOnTable = result.intendedPayoff - equilibriumPayoff;
      }
    }
  }
  return result;
}

export function renderGameReport(g: Game, a: GameAnalysis): string {
  const lines: string[] = [];
  lines.push(`# Multi-Agent Coordination Analysis — ${g.players.join(" vs ")}`);
  lines.push("");
  lines.push("_FORECAST (model-derived): the equilibrium behavior of the declared incentive, not a live multi-agent run._");
  lines.push("");
  if (a.dominant) {
    lines.push(`- **Dominant strategy (each agent): \`${a.dominant}\`** — strictly best regardless of the opponent.`);
    lines.push(`- **Dominant-strategy equilibrium: \`(${a.equilibrium!.join(", ")})\`** → payoff **${a.equilibriumPayoff}** each.`);
  } else {
    lines.push("- _No dominant strategy (a mixed-strategy equilibrium — RPS-shaped — would be needed; follow-up)._");
  }
  if (a.intendedJoint) {
    lines.push(`- **Intended joint action: \`(${a.intendedJoint.join(", ")})\`** → payoff **${a.intendedPayoff}** each.`);
  }
  if (a.coordinationFailure) {
    lines.push(`- **Coordination failure:** equilibrium diverges from intent. Individual reward drives defection.`);
    if (a.priceOfAnarchy != null) {
      lines.push(`- **Price of anarchy = ${round(a.priceOfAnarchy)}** (${a.valueLeftOnTable} units left on the table per agent).`);
    }
    lines.push(`- **Fix (structural):** reward the **joint/team outcome**, not the individual one, so cooperation is no longer dominated.`);
  } else if (a.intendedJoint) {
    lines.push("- Equilibrium matches intent — no coordination failure.");
  }
  lines.push("");
  return lines.join("\n");
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// CLI: `npx tsx scripts/lib/payoff/game.ts <incentiveStateDir>`
if (process.argv[1]?.endsWith("game.ts") && process.argv[1]?.includes("payoff")) {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write("usage: game.ts <incentiveStateDir>\n");
    process.exit(2);
  }
  const g = loadGame(dir);
  const a = analyzeGame(g);
  process.stdout.write(renderGameReport(g, a) + "\n");
}
