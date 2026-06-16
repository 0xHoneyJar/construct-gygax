/**
 * mermaid.ts — deterministic Mermaid structure diagram for the parametric sweep (cycle-011, FR-1).
 *
 * Renders threshold crossings and spikes as a fenced `graph LR` — the renderer-independent fallback
 * to the inline SVG (Mermaid renders on GitHub regardless; SDD §10 Q1). Node ids are derived from
 * array position only (no entropy), ordering is crossovers-then-spikes in existing array order, and
 * labels are HTML-escaped so `>`/`<` in thresholds never break the fence (FR-1.3 / SDD §4.1b). The
 * empty case prints a valid single-node "No crossings or spikes" note (FR-1.5).
 *
 * Takes only the fields it needs (not the whole SweepResult) to avoid a type cycle with report.ts.
 */
import type { Crossover, Spike } from "./crossover.ts";

export interface StructureInput {
  variable: string;
  crossovers: Crossover[];
  spikes: Spike[];
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Render the crossover/spike structure as a fenced Mermaid `graph LR` block (always emitted). */
export function renderStructureDiagram(input: StructureInput): string {
  const { variable, crossovers, spikes } = input;
  const lines: string[] = ["```mermaid", "graph LR"];

  if (crossovers.length === 0 && spikes.length === 0) {
    lines.push(`  note["No crossings or spikes"]`);
    lines.push("```");
    return lines.join("\n");
  }

  crossovers.forEach((c, i) => {
    const where = c.x === null ? "no crossing in domain" : `${variable} = ${c.x}`;
    lines.push(
      `  c${i}m["${esc(c.metric)}"] -->|"${esc(`${c.op} ${c.value}`)}"| c${i}t["${esc(where)}"]`,
    );
  });

  spikes.forEach((s, i) => {
    const jump = `${s.jump >= 0 ? "+" : ""}${s.jump}`;
    lines.push(
      `  s${i}m["${esc(s.metric)}"] -.->|"${esc(`spike ${jump}`)}"| s${i}x["${esc(`${variable} = ${s.x}`)}"]`,
    );
  });

  lines.push("```");
  return lines.join("\n");
}
