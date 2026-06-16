/**
 * svg.ts — deterministic inline-SVG sparklines for parametric sweep curves (cycle-011, FR-1).
 *
 * Hand-rolled path geometry from the already-computed series points — no external renderer, no new
 * dependency (NFR-2). Byte-reproducible: fixed viewBox, fixed strokes, fixed 2-decimal precision,
 * points in series order, no entropy in ids (FR-1.3 / SDD §4.1a). Raw inline `<svg>` so the curve
 * shape reads at a glance; the always-emitted Mermaid block (mermaid.ts) is the renderer-independent
 * fallback (SDD §10 Q1).
 */
import type { MetricSeries } from "./sweep.ts";

export interface SparklineOpts {
  width?: number;
  height?: number;
  pad?: number;
  /** Data-space x values to draw as vertical crossing markers (e.g. a threshold first-crossing). */
  markers?: number[];
}

/** Fixed 2-decimal formatting — the determinism backbone (no float drift across runs/platforms). */
const f = (n: number): string => n.toFixed(2);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Render one metric series as a labelled inline-SVG sparkline (a Markdown fragment: a label line, a
 * blank line, then the `<svg>`). Degenerate inputs render gracefully and never throw (FR-1.5):
 * empty → a note; single point → a dot; flat → a mid-height line.
 */
export function renderSparkline(series: MetricSeries, opts: SparklineOpts = {}): string {
  const width = opts.width ?? 240;
  const height = opts.height ?? 60;
  const pad = opts.pad ?? 4;
  const samples = series.samples;

  if (samples.length === 0) {
    return `**\`${esc(series.id)}\`** (${series.kind}) — _no samples_`;
  }

  const xs = samples.map((s) => s.x);
  const ys = samples.map((s) => s.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const flat = maxY === minY;
  const spanY = maxY - minY || 1;

  const px = (x: number): number => pad + ((x - minX) / spanX) * (width - 2 * pad);
  const py = (v: number): number => (flat ? height / 2 : height - pad - ((v - minY) / spanY) * (height - 2 * pad));

  const label = `**\`${esc(series.id)}\`** (${series.kind}) — ${samples.length} pt, ${minY}→${maxY}`;

  const points = samples.map((s) => `${f(px(s.x))},${f(py(s.value))}`).join(" ");
  const first = samples[0];
  const last = samples[samples.length - 1];

  const svg: string[] = [];
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(series.id)} curve">`,
  );
  svg.push(`<title>${esc(series.id)}</title>`);
  // threshold-crossing markers (deterministic, in given order, clamped to domain)
  for (const m of opts.markers ?? []) {
    if (m < minX || m > maxX) continue;
    svg.push(
      `<line x1="${f(px(m))}" y1="${f(pad)}" x2="${f(px(m))}" y2="${f(height - pad)}" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2" />`,
    );
  }
  if (samples.length === 1) {
    svg.push(`<circle cx="${f(px(first.x))}" cy="${f(py(first.value))}" r="2" fill="#3b82f6" />`);
  } else {
    svg.push(`<polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="1.5" />`);
    svg.push(`<circle cx="${f(px(first.x))}" cy="${f(py(first.value))}" r="1.5" fill="#3b82f6" />`);
    svg.push(`<circle cx="${f(px(last.x))}" cy="${f(py(last.value))}" r="1.5" fill="#3b82f6" />`);
  }
  svg.push(`</svg>`);

  return `${label}\n\n${svg.join("")}`;
}
