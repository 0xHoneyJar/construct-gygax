/**
 * reconcile.ts — reconcile a revealed preference against the forecast Decision Point Map and an
 * optional candidate policy (cycle-012, Sprint 36; FR-2).
 *
 * NOT a reuse of diff.ts (that is rung/argmax/fix-hack-bound) but an adoption of its discipline
 * (sdd.md §1.2 C-2): small-N honesty via `withinNoise` (a thin segment never asserts a direction),
 * and a claim tag on every finding — the OBSERVED side carries the corpus's claim, the forecast/policy
 * side is `model-forecast`, and the two are never blended.
 */
import type { ClaimStrength } from "./sidecar.ts";
import { type RevealedPreference, rateOf } from "./revealed.ts";

/** A structured Decision Point Map entry (Cabal SKILL Step 2.7d, as a machine-readable forecast). */
export interface ForecastDecisionPoint {
  id: string;
  description: string;
  call: "dominant" | "false-choice" | "balanced";
  options: string[];
  dominantType?: string;
}
export interface ForecastDecisionMap {
  points: ForecastDecisionPoint[];
  claim: "model-forecast";
}

/** A candidate policy as a ranked list of option types (rank 1 = highest priority). */
export interface CandidatePolicy {
  id: string;
  ordering: string[];
}

export type FindingKind =
  | "revealed-dominant-line"
  | "false-choice-confirmed"
  | "false-choice-missed"
  | "dominant-over-called"
  | "policy-divergence"
  | "no-divergence";

export interface StrategyFinding {
  claim: ClaimStrength; // first line of the rendered finding (observed > simulation-derived > model-forecast)
  kind: FindingKind;
  summary: string;
  evidence: string;
  withinNoise: boolean;
}

export interface ReconcileOptions {
  thetaHigh?: number; // near-unanimity threshold for a false choice (default 0.9)
  thetaDom?: number; // min observed top-rate to sustain a "dominant" forecast (default 0.5)
  nFloor?: number; // min decisions in the segment for a confident call (default 5)
}

export interface Reconciliation {
  claim: ClaimStrength; // the corpus's observed claim
  findings: StrategyFinding[];
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

/** Reconcile the overall revealed ordering against the forecast map and/or a candidate policy. */
export function reconcile(
  rp: RevealedPreference,
  forecast?: ForecastDecisionMap,
  policy?: CandidatePolicy,
  opts: ReconcileOptions = {},
): Reconciliation {
  const thetaHigh = opts.thetaHigh ?? 0.9;
  const thetaDom = opts.thetaDom ?? 0.5;
  const nFloor = opts.nFloor ?? 5;
  const ord = rp.overall;
  const obsClaim = rp.claim;
  const thin = ord.n < nFloor; // small-N honesty: a thin corpus asserts no direction (C-2)
  const findings: StrategyFinding[] = [];

  // 1. The revealed dominant line (always).
  const top = ord.ordering[0];
  if (top) {
    findings.push({
      claim: obsClaim,
      kind: "revealed-dominant-line",
      summary: `Revealed dominant line: ${ord.ordering.join(" > ")}.`,
      evidence: `top action ${top} chosen ${pct(rateOf(ord, top))} of the times it was offered (n=${ord.n}).`,
      withinNoise: thin,
    });
  }

  // 2. Forecast reconciliation (per Decision Point Map entry).
  if (forecast) {
    for (const p of forecast.points) {
      const rated = p.options
        .map((t) => ({ t, rate: rateOf(ord, t) }))
        .sort((a, b) => b.rate - a.rate || a.t.localeCompare(b.t));
      const topOpt = rated[0];
      if (!topOpt) continue;
      const near = topOpt.rate >= thetaHigh;
      let kind: FindingKind;
      let summary: string;
      if (p.call === "false-choice" && near) {
        kind = "false-choice-confirmed";
        summary = `Forecast false-choice CONFIRMED at "${p.description}": play collapses to ${topOpt.t}.`;
      } else if (p.call === "balanced" && near) {
        kind = "false-choice-missed";
        summary = `Forecast MISSED a false choice at "${p.description}": forecast "balanced", but play is a near-pure ${topOpt.t} line.`;
      } else if (p.call === "dominant" && topOpt.rate < thetaDom) {
        kind = "dominant-over-called";
        summary = `Forecast OVER-CALLED dominance at "${p.description}": forecast dominant${p.dominantType ? ` (${p.dominantType})` : ""}, but observed play is mixed.`;
      } else {
        kind = "no-divergence";
        summary = `Forecast agrees with play at "${p.description}" (${p.call}).`;
      }
      findings.push({
        claim: obsClaim,
        kind,
        summary,
        evidence: `observed top ${topOpt.t} ${pct(topOpt.rate)}; forecast ${p.call} [model-forecast]; n=${ord.n}.`,
        withinNoise: thin,
      });
    }
  }

  // 3. Candidate-policy divergence (ranked by |Δrank|, then observed rank, then type).
  if (policy) {
    const obsRank = new Map(ord.ordering.map((t, i) => [t, i + 1]));
    const candRank = new Map(policy.ordering.map((t, i) => [t, i + 1]));
    const diffs = policy.ordering
      .filter((t) => obsRank.has(t))
      .map((t) => ({ t, cand: candRank.get(t)!, obs: obsRank.get(t)!, d: Math.abs(candRank.get(t)! - obsRank.get(t)!) }))
      .filter((x) => x.d > 0)
      .sort((a, b) => b.d - a.d || a.obs - b.obs || a.t.localeCompare(b.t));
    for (const x of diffs) {
      findings.push({
        claim: obsClaim,
        kind: "policy-divergence",
        summary: `Policy divergence: ${policy.id} ranks ${x.t} #${x.cand}, but play reveals it #${x.obs} (Δ${x.d}).`,
        evidence: `${x.t}: candidate #${x.cand} → observed #${x.obs} [${policy.id}=model-forecast]; n=${ord.n}.`,
        withinNoise: thin,
      });
    }
    if (diffs.length === 0) {
      findings.push({
        claim: obsClaim,
        kind: "no-divergence",
        summary: `Candidate policy ${policy.id} matches the revealed ordering.`,
        evidence: `no rank gaps over the shared option types; n=${ord.n}.`,
        withinNoise: thin,
      });
    }
  }

  return { claim: obsClaim, findings };
}
