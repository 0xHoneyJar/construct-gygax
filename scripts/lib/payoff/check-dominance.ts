/**
 * check-dominance.ts — the payoff engine's dominance check as a callable verdict
 * (cycle-009, Sprint 3; FR-2.1/FR-2.2, sdd §5.1).
 *
 * Pure: derives the verdict from an existing IncentiveAnalysis — payoff semantics are
 * REUSED (matrix.ts nets at integer context steps), never re-implemented (NFR-6).
 *
 * Semantics (mirrors Arneson's check_payoff_dominance.py PASS/WARN rule): scanning contexts
 * in ascending order, the verdict is `hack-dominates` iff some action ≠ intendedAction has
 * net >= intendedNet (within the module's existing EPS = 1e-9 tolerance) at some integer
 * context step; otherwise `no-dominance`. `indeterminate` when the incentive-state declares
 * no intent.intended_action or declares no non-intended actions — a property of the input,
 * not a failure (exit 0 at the CLI; warn-not-reject parity with Arneson's NFR-5).
 *
 * Known sampling difference (documented, not hidden — sdd §5.1): Gygax samples INTEGER steps
 * of the domain (matrix.ts steps()); Arneson samples 50 evenly spaced points. A hack dominant
 * only between integer points could diverge — conformance (FR-2.2) is therefore verdict-level
 * on the dungeon fixture.
 */
import { EPS } from "./dominance.ts";
import type { IncentiveAnalysis } from "./report.ts";

export type DominanceVerdict = "hack-dominates" | "no-dominance" | "indeterminate";

export interface DominanceCheck {
  verdict: DominanceVerdict;
  /** First (context, action) where a non-intended action's net >= intended net. */
  point?: { context: number; action: string; net: number; intendedNet: number };
  intendedAction?: string; // absent → verdict "indeterminate"
  reason?: string; // set when indeterminate (no intent / no candidate hacks)
}

/** Pure verdict over an existing analysis: contexts ascending, actions in declared order. */
export function checkDominance(analysis: IncentiveAnalysis): DominanceCheck {
  const m = analysis.matrix;
  const intendedAction = analysis.dominance.intendedAction;

  if (!intendedAction) {
    return {
      verdict: "indeterminate",
      reason: "incentive-state declares no intent.intended_action — cannot identify the honest action",
    };
  }
  const intendedNets = m.net.get(intendedAction);
  if (!intendedNets) {
    return {
      verdict: "indeterminate",
      intendedAction,
      reason: `intended action '${intendedAction}' is not among the declared actions`,
    };
  }
  const candidates = m.actions.filter((a) => a !== intendedAction);
  if (candidates.length === 0) {
    return {
      verdict: "indeterminate",
      intendedAction,
      reason: "no candidate hack actions (only the intended action declared)",
    };
  }

  // Scan contexts ascending (matrix.contexts is built ascending); first hit wins.
  for (let i = 0; i < m.contexts.length; i++) {
    const intendedNet = intendedNets[i];
    for (const action of candidates) {
      const net = m.net.get(action)![i];
      if (net >= intendedNet - EPS) {
        return {
          verdict: "hack-dominates",
          point: { context: m.contexts[i], action, net, intendedNet },
          intendedAction,
        };
      }
    }
  }
  return { verdict: "no-dominance", intendedAction };
}
