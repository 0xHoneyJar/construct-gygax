/**
 * dominance.ts — dominant-strategy / dominated-action / argmax detection (cycle-006, Sprint 1).
 *
 * The core reward-hacking detectors (intransitive-and-matchup-balance.md):
 *   - dominated action  = never optimal (a dead tool — taxonomy L7 dump)
 *   - dominant action   = ≥ all others in every context (the reward hack — L7 god)
 *   - argmax-per-context = the agent's predicted policy
 * Intent-vs-optimal (Goodhart) framing + the knob recommendation are Sprint 2; this surfaces the
 * raw `intendedActionEverOptimal` boolean as its seed.
 */
import type { PayoffMatrix } from "./matrix.ts";

/** Shared numeric tolerance for payoff comparisons (reused by check-dominance.ts — cycle-009). */
export const EPS = 1e-9;

export interface ArgmaxPoint {
  context: number;
  action: string; // the argmax action (deterministic tie-break: declared order)
  net: number;
  tie: boolean; // true if another action ties within EPS
}

/** Best action at each context (deterministic: first in declared order on ties). */
export function argmaxPerContext(m: PayoffMatrix): ArgmaxPoint[] {
  return m.contexts.map((c, i) => {
    let best = m.actions[0];
    let bestVal = m.net.get(best)![i];
    let tie = false;
    for (const a of m.actions) {
      const v = m.net.get(a)![i];
      if (v > bestVal + EPS) {
        bestVal = v;
        best = a;
        tie = false;
      } else if (Math.abs(v - bestVal) <= EPS && a !== best) {
        tie = true;
      }
    }
    return { context: c, action: best, net: bestVal, tie };
  });
}

/** Does action `i` (weakly) dominate action `j` — ≥ in every context, strict in at least one? */
export function dominates(m: PayoffMatrix, i: string, j: string): boolean {
  const a = m.net.get(i)!;
  const b = m.net.get(j)!;
  let strictSomewhere = false;
  for (let k = 0; k < a.length; k++) {
    if (a[k] < b[k] - EPS) return false; // i is worse somewhere → does not dominate
    if (a[k] > b[k] + EPS) strictSomewhere = true;
  }
  return strictSomewhere;
}

/** Actions dominated by some other action (never optimal — dead tools). */
export function dominatedActions(m: PayoffMatrix): string[] {
  return m.actions.filter((j) => m.actions.some((i) => i !== j && dominates(m, i, j)));
}

/** An action that dominates ALL others (the reward hack), or null if none is universally dominant. */
export function dominantAction(m: PayoffMatrix): string | null {
  for (const i of m.actions) {
    if (m.actions.every((j) => j === i || dominates(m, i, j))) return i;
  }
  return null;
}

export interface DominanceResult {
  argmax: ArgmaxPoint[];
  dominant: string | null; // the reward hack
  dominated: string[]; // dead tools
  intendedAction?: string;
  intendedActionEverOptimal?: boolean; // seed of the Goodhart check (Sprint 2)
}

export function analyzeDominance(m: PayoffMatrix, intendedAction?: string): DominanceResult {
  const argmax = argmaxPerContext(m);
  const result: DominanceResult = {
    argmax,
    dominant: dominantAction(m),
    dominated: dominatedActions(m),
    intendedAction,
  };
  if (intendedAction) {
    result.intendedActionEverOptimal = argmax.some((p) => p.action === intendedAction);
  }
  return result;
}
