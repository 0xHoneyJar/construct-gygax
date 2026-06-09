/**
 * report.ts — deterministic Markdown for incentive analysis (cycle-006, Sprint 1).
 * Forecast-tagged: this predicts where the DECLARED incentive will be gamed; it does not observe a
 * live agent (agent-incentive-analysis.md §9). No Date.now() — stable output.
 */
import type { PayoffMatrix } from "./matrix.ts";
import type { DominanceResult } from "./dominance.ts";
import type { GoodhartResult } from "./goodhart.ts";

export interface IncentiveAnalysis {
  matrix: PayoffMatrix;
  dominance: DominanceResult;
  goodhart?: GoodhartResult | null;
}

export function renderIncentiveReport(a: IncentiveAnalysis): string {
  const { matrix: m, dominance: d } = a;
  const lines: string[] = [];
  lines.push(`# Incentive Analysis — context \`${m.context}\`, domain ${m.domain.min}–${m.domain.max}`);
  lines.push("");
  lines.push("_FORECAST (model-derived): predicts where the declared incentive structure will be gamed. Not an observation of a live agent._");
  lines.push("");

  // Reward hack (dominant strategy)
  lines.push("## Dominant strategy (reward hack)");
  lines.push("");
  if (d.dominant) {
    lines.push(`- **\`${d.dominant}\` dominates** — its payoff is ≥ every other action in every context. The agent will collapse onto it.`);
  } else {
    lines.push("- _No universally dominant action (no single reward hack across all contexts)._");
  }
  lines.push("");

  // Dead tools (dominated)
  lines.push("## Dead actions (dominated — never optimal)");
  lines.push("");
  if (d.dominated.length > 0) {
    for (const id of d.dominated) lines.push(`- \`${id}\``);
  } else {
    lines.push("- _None — every action is optimal in some context._");
  }
  lines.push("");

  // Goodhart — intent-vs-optimal divergence + the incentive fix (Sprint 2).
  const g = a.goodhart;
  if (g) {
    lines.push("## Specification gaming (intent vs optimal)");
    lines.push("");
    if (g.diverges) {
      lines.push(`- Declared intended action \`${g.intendedAction}\` is **never optimal → specification gaming.**`);
      lines.push(
        `- **Severity:** the gap between the gamed action and \`${g.intendedAction}\` reaches ${round(g.maxGap)} and is **${g.gapTrend}** with \`${m.context}\` (the harder the work, the stronger the pull to game).`,
      );
    } else {
      lines.push(`- Intended action \`${g.intendedAction}\` is optimal where it should be — no specification gaming.`);
    }
    lines.push("");
    lines.push("### Incentive fix");
    lines.push("");
    const r = g.recommendation;
    if (r.kind === "single-knob") {
      lines.push(`- **Tunable knob:** ${r.detail}`);
    } else if (r.kind === "structural") {
      lines.push(`- **Structural (not a knob tweak):** ${r.detail}`);
      if (r.whackAMole) lines.push(`  - _Whack-a-mole:_ penalizing \`${r.whackAMole.penalized}\` → optimal shifts to \`${r.whackAMole.shiftsTo}\`.`);
    } else {
      lines.push(`- ${r.detail}`);
    }
    lines.push("");
  } else if (d.intendedAction) {
    lines.push(`## Intent\n\n- Declared intended action: \`${d.intendedAction}\` — ${d.intendedActionEverOptimal ? "optimal in at least one context." : "**never optimal → specification gaming.**"}\n`);
  }

  // Optimal policy (argmax per context)
  lines.push("## Predicted policy (argmax per context)");
  lines.push("");
  lines.push(`| ${m.context} | optimal action | net |`);
  lines.push("|----|----------------|----:|");
  for (const p of d.argmax) {
    lines.push(`| ${p.context} | \`${p.action}\`${p.tie ? " *(tie)*" : ""} | ${round(p.net)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
