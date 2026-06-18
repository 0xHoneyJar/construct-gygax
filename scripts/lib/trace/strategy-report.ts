/**
 * strategy-report.ts — render the "Revealed Strategy" report section (cycle-012, Sprint 36; FR-2/FR-3).
 *
 * Deterministic markdown: fixed precision, stable ordering, no Date/RNG — same discipline as report.ts.
 * Findings render claim-tag-first; the revealed≠optimal note and the claim-discipline legend are always present.
 */
import type { RevealedPreference, RevealedOrdering } from "./revealed.ts";
import type { Reconciliation } from "./reconcile.ts";
import type { ClaimStrength } from "./sidecar.ts";

const CLAIM_LABEL: Record<ClaimStrength, string> = {
  "real-agent-observed": "observed",
  "simulation-derived": "simulation-derived",
  "model-forecast": "model-forecast",
};

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function orderingTable(o: RevealedOrdering, lines: string[]): void {
  lines.push("| Rank | Action type | Conditional pick-rate | Offered | Chosen |");
  lines.push("|-----:|-------------|----------------------:|--------:|-------:|");
  o.ordering.forEach((type, i) => {
    const f = o.byType.find((b) => b.type === type)!;
    lines.push(`| ${i + 1} | ${type} | ${pct(f.rate)} | ${f.offered} | ${f.chosen} |`);
  });
}

/** Render the full Revealed Strategy section (the unit folded into a `/cabal` playtest report). */
export function renderStrategyReport(rp: RevealedPreference, rec: Reconciliation): string {
  const lines: string[] = [];
  lines.push("## Revealed Strategy");
  lines.push("");
  lines.push(
    `Claim strength: **${CLAIM_LABEL[rp.claim]}** — revealed preference over ${rp.overall.n} decisions ` +
      `(${rp.segments.length} segment${rp.segments.length === 1 ? "" : "s"}). **Revealed ≠ optimal:** this is the ` +
      `empirical equilibrium of the corpus, not a proof of best play.`,
  );
  lines.push("");
  lines.push("### Revealed ordering (overall)");
  orderingTable(rp.overall, lines);
  lines.push("");

  if (rp.segments.length > 1) {
    for (const s of rp.segments) {
      lines.push(`### Segment: ${s.segment} (n=${s.n})`);
      orderingTable(s, lines);
      lines.push("");
    }
  }

  lines.push("### Findings");
  for (const f of rec.findings) {
    const noise = f.withinNoise ? " _(within noise — thin sample, no direction asserted)_" : "";
    lines.push(`- **[${CLAIM_LABEL[f.claim]}]** ${f.summary}${noise}`);
    lines.push(`  - ${f.evidence}`);
  }
  lines.push("");
  lines.push(
    "> Claim discipline: observed > simulation-derived > model-forecast. The observed ordering is from real " +
      "play; forecast and candidate-policy lines are model-forecast and are never blended into it.",
  );
  return lines.join("\n") + "\n";
}
