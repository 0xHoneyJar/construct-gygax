/**
 * goodhart.ts — intent-vs-optimal divergence + incentive-knob recommendation (cycle-006, Sprint 2).
 *
 * The payoff of the whole direction: given a declared `intent`, detect *specification gaming* (the
 * agent's optimal action ≠ the intended one) and recommend the cheapest incentive change that
 * realigns it — distinguishing a fixable single-knob case from a **whack-a-mole / structural** case
 * where penalizing one hack just shifts the agent to the next-best hack.
 *
 * This establishes `intent` as a first-class, typed input — the layer the cycle-005 AC#3 deferral
 * (cost-curve-divergence) was waiting on. Intent–reality is the spine; this is its terminal.
 */
import type { PayoffMatrix } from "./matrix.ts";
import { argmaxPerContext, type DominanceResult } from "./dominance.ts";

const EPS = 1e-9;

export interface KnobRecommendation {
  kind: "none" | "single-knob" | "structural";
  detail: string;
  penalizedAction?: string; // single-knob: which action to penalize
  penalty?: number; // single-knob: penalize cost by MORE than this
  whackAMole?: { penalized: string; shiftsTo: string }; // structural: the cheap knob fails this way
}

export interface GoodhartResult {
  intendedAction: string;
  diverges: boolean; // optimal policy diverges from intent (spec gaming)
  gapByContext: { context: number; gap: number }[]; // net(optimal) − net(intended) per context
  maxGap: number;
  gapTrend: "rising" | "falling" | "flat";
  recommendation: KnobRecommendation;
}

function trend(gaps: number[]): GoodhartResult["gapTrend"] {
  if (gaps.length < 2) return "flat";
  const d = gaps[gaps.length - 1] - gaps[0];
  if (d > EPS) return "rising";
  if (d < -EPS) return "falling";
  return "flat";
}

/** Re-run argmax on a copy of the matrix with one action's payoff reduced by `penalty`. */
function argmaxWithPenalty(m: PayoffMatrix, action: string, penalty: number) {
  const net = new Map(m.net);
  net.set(action, m.net.get(action)!.map((v) => v - penalty));
  return argmaxPerContext({ ...m, net });
}

export function analyzeGoodhart(m: PayoffMatrix, d: DominanceResult): GoodhartResult | null {
  const intended = d.intendedAction;
  if (!intended || !m.net.has(intended)) return null;

  const intendedNet = m.net.get(intended)!;
  const gapByContext = d.argmax.map((p, i) => ({ context: p.context, gap: p.net - intendedNet[i] }));
  const gaps = gapByContext.map((g) => g.gap);
  const maxGap = Math.max(...gaps);
  const diverges = !d.intendedActionEverOptimal && maxGap > EPS;

  let recommendation: KnobRecommendation;
  if (!diverges) {
    recommendation = { kind: "none", detail: `Intended action \`${intended}\` is already optimal; no realignment needed.` };
  } else {
    // The main blocker = the dominant action, else the most frequent argmax.
    const blocker = d.dominant ?? mostFrequentArgmax(d);
    // Penalty needed to demote the blocker below intended in EVERY context.
    const blockerNet = m.net.get(blocker)!;
    const demoteGaps = blockerNet.map((v, i) => v - intendedNet[i]);
    const penalty = Math.max(...demoteGaps); // penalize by strictly more than this
    // Apply just past that, re-check the optimal policy.
    const after = argmaxWithPenalty(m, blocker, penalty + Math.max(EPS, penalty * 1e-6 + 1e-6));
    const realigned = after.every((p) => p.action === intended);
    if (realigned) {
      recommendation = {
        kind: "single-knob",
        penalizedAction: blocker,
        penalty,
        detail: `Penalize \`${blocker}\` cost by more than ${round(penalty)} → \`${intended}\` becomes optimal in every context.`,
      };
    } else {
      const shiftsTo = after.find((p) => p.action !== intended)?.action ?? "another hack";
      recommendation = {
        kind: "structural",
        whackAMole: { penalized: blocker, shiftsTo },
        detail:
          `Penalizing \`${blocker}\` shifts the optimal action to \`${shiftsTo}\` — the next-best hack (whack-a-mole). ` +
          `Multiple actions beat \`${intended}\` because the reward does not measure intent. ` +
          `Fix is STRUCTURAL: reward a signal the gamed actions cannot move (e.g. held-out coverage), not a per-action penalty.`,
      };
    }
  }

  return { intendedAction: intended, diverges, gapByContext, maxGap, gapTrend: trend(gaps), recommendation };
}

function mostFrequentArgmax(d: DominanceResult): string {
  const counts = new Map<string, number>();
  for (const p of d.argmax) counts.set(p.action, (counts.get(p.action) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
