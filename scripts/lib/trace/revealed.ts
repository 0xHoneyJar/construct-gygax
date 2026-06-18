/**
 * revealed.ts — the revealed-preference extractor (cycle-012, Sprint 35; FR-1).
 *
 * A decision-trace corpus → conditional pick-frequencies + a pairwise revealed ordering, computed per
 * `context.segment` AND overall (roadmap §5a: segment, don't average). Deterministic — exact ratios
 * here, fixed precision applied at the report layer; stable type ordering with a localeCompare tiebreak.
 *
 * Method mirrors the PTCG `mine_pilot_policy` ground truth (sdd.md §3.1): for each decision the chosen
 * type(s) "beat" every other offered type; a type's rank is its mean pairwise win-rate over the
 * opponents it co-occurred with — the metric that puts ATTACH #1 in the fixture.
 */
import type { Corpus, DecisionRecord } from "./decision.ts";
import type { SidecarClaim } from "./sidecar.ts";

/** Conditional pick-rate for an option type: chosen / offered (an offered-but-unchosen type is a "pass"). */
export interface TypeFreq {
  type: string;
  offered: number; // # decisions where this type was in the legal set
  chosen: number; // # of those where it was chosen
  rate: number; // chosen / offered
}

/** Head-to-head between two types over decisions where both were offered. */
export interface PairwiseCell {
  a: string;
  b: string;
  aOverB: number; // a chosen & b offered-not-chosen
  bOverA: number;
  n: number; // aOverB + bOverA (decisive co-offerings)
}

export interface RevealedOrdering {
  segment: string; // "overall" or a context.segment value
  n: number; // decisions in this segment
  byType: TypeFreq[]; // sorted by type id (stable)
  pairwise: PairwiseCell[]; // decisive pairs only (n > 0)
  ordering: string[]; // types ranked by mean pairwise win-rate (revealed preference)
}

export interface RevealedPreference {
  claim: SidecarClaim;
  overall: RevealedOrdering;
  segments: RevealedOrdering[];
}

function distinctTypes(opts: { type: string }[]): Set<string> {
  return new Set(opts.map((o) => o.type));
}

/** Mean pairwise win-rate of `t` over the opponents it co-occurred with (0 if it never co-occurred). */
function winRate(t: string, types: string[], wins: Map<string, Map<string, number>>): number {
  const rates: number[] = [];
  for (const u of types) {
    if (u === t) continue;
    const w = wins.get(t)?.get(u) ?? 0;
    const l = wins.get(u)?.get(t) ?? 0;
    if (w + l > 0) rates.push(w / (w + l));
  }
  return rates.length ? rates.reduce((x, y) => x + y, 0) / rates.length : 0;
}

function order(records: DecisionRecord[], segment: string): RevealedOrdering {
  const offeredCt = new Map<string, number>();
  const chosenCt = new Map<string, number>();
  const wins = new Map<string, Map<string, number>>(); // wins[a][b] = a chosen & b offered-not-chosen
  const bump = (a: string, b: string) => {
    if (!wins.has(a)) wins.set(a, new Map());
    const row = wins.get(a)!;
    row.set(b, (row.get(b) ?? 0) + 1);
  };

  for (const r of records) {
    const off = distinctTypes(r.offered);
    const cho = distinctTypes(r.chosen);
    for (const t of off) offeredCt.set(t, (offeredCt.get(t) ?? 0) + 1);
    for (const t of cho) chosenCt.set(t, (chosenCt.get(t) ?? 0) + 1);
    for (const ct of cho) for (const b of off) if (b !== ct) bump(ct, b);
  }

  const types = [...offeredCt.keys()].sort();
  const byType: TypeFreq[] = types.map((type) => {
    const offered = offeredCt.get(type) ?? 0;
    const chosen = chosenCt.get(type) ?? 0;
    return { type, offered, chosen, rate: offered > 0 ? chosen / offered : 0 };
  });

  const pairwise: PairwiseCell[] = [];
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      const a = types[i];
      const b = types[j];
      const aOverB = wins.get(a)?.get(b) ?? 0;
      const bOverA = wins.get(b)?.get(a) ?? 0;
      if (aOverB + bOverA > 0) pairwise.push({ a, b, aOverB, bOverA, n: aOverB + bOverA });
    }
  }

  const score = new Map(types.map((t) => [t, winRate(t, types, wins)]));
  const ordering = [...types].sort((a, b) => {
    const d = (score.get(b) ?? 0) - (score.get(a) ?? 0);
    return d !== 0 ? d : a.localeCompare(b); // stable tiebreak → deterministic
  });

  return { segment, n: records.length, byType, pairwise, ordering };
}

/** Extract the revealed preference of a corpus: overall + one ordering per `context.segment`. */
export function extractRevealed(corpus: Corpus): RevealedPreference {
  const overall = order(corpus.records, "overall");
  const bySeg = new Map<string, DecisionRecord[]>();
  for (const r of corpus.records) {
    const k = r.context.segment;
    if (!bySeg.has(k)) bySeg.set(k, []);
    bySeg.get(k)!.push(r);
  }
  const segments = [...bySeg.keys()].sort().map((k) => order(bySeg.get(k)!, k));
  return { claim: corpus.claim, overall, segments };
}

/** Convenience: a type's conditional pick-rate in an ordering (0 if the type never appeared). */
export function rateOf(ord: RevealedOrdering, type: string): number {
  return ord.byType.find((t) => t.type === type)?.rate ?? 0;
}
