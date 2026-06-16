/**
 * check.ts — `/gygax check`: the analyst's own diagnostic health (cycle-011, FR-3).
 *
 * A curated, FAST, self-contained subset (NOT the full evals/harness.sh) that builds designer trust
 * by making Gygax's own health legible. Four sub-checks in fixed order, each isolated so one failure
 * never aborts the others; deterministic plain-text summary; exit 0 = PASS / 1 = FAIL (FR-3.3/3.5).
 *
 * Self-contained: no external services, no sandbox/network, NO Arneson coupling (NFR-3). Reuses the
 * FR-1 golden (golden-integrity) and the FR-2 validator (archetype-schema) as its backbone.
 *
 * CLI: `tsx scripts/lib/check/check.ts` — the `check` subcommand of `/gygax` routes here.
 */
import { existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadYaml, loadAndMerge, DEFAULT_BUILTINS, DEFAULT_USER_DIR } from "../archetypes/validate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

export interface HealthSummary {
  checks: CheckResult[];
  pass: boolean;
}

/** Run a sub-check, converting any throw into a deterministic FAIL result (isolation — FR-3). */
function guarded(name: string, fn: () => string): CheckResult {
  try {
    return { name, pass: true, detail: fn() };
  } catch (e) {
    return { name, pass: false, detail: (e as Error).message };
  }
}

// ─── Sub-checks (fixed order) ────────────────────────────────────────────────────────────────────

/** (1) Golden integrity — the FR-1 parametric golden + capability proof still passes. */
function checkGoldenIntegrity(root: string): CheckResult {
  return guarded("golden-integrity", () => {
    const test = join(root, "scripts", "lib", "parametric", "parametric.test.ts");
    if (!existsSync(test)) throw new Error(`missing ${test}`);
    try {
      execFileSync(TSX, [test], { encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      const tail = (err.stderr || err.stdout || "").trim().split("\n").slice(-3).join(" | ");
      throw new Error(`parametric golden/capability proof FAILED: ${tail || "non-zero exit"}`);
    }
    return "parametric golden + capability proof pass (incl. FR-1 SVG/Mermaid byte-equality)";
  });
}

/** (2) Expected-findings fixtures — every evals/expected/*.yaml is well-formed. */
function checkExpectedFindings(root: string): CheckResult {
  return guarded("expected-findings", () => {
    const dir = join(root, "evals", "expected");
    if (!existsSync(dir)) throw new Error(`missing ${dir}`);
    const files = readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort();
    if (files.length === 0) throw new Error(`no fixtures in ${dir}`);
    const bad: string[] = [];
    for (const f of files) {
      const doc = loadYaml(join(dir, f)) as Record<string, unknown> | null;
      if (!doc || typeof doc.fixture !== "string" || !("expected_findings" in doc)) {
        bad.push(f);
      }
    }
    if (bad.length) throw new Error(`malformed fixtures (need \`fixture\` + \`expected_findings\`): ${bad.join(", ")}`);
    return `${files.length} expected-findings fixtures well-formed`;
  });
}

/** (3) Archetype schema — built-ins + user archetypes validate and merge with no collisions (FR-2). */
function checkArchetypeSchema(builtinsPath: string, userDir: string): CheckResult {
  return guarded("archetype-schema", () => {
    const { archetypes, errors } = loadAndMerge(builtinsPath, userDir);
    if (errors.length) throw new Error(`${errors.length} archetype error(s): ${errors.slice(0, 3).join(" ; ")}${errors.length > 3 ? " …" : ""}`);
    return `${archetypes.length} archetypes validate (built-ins + user), no id collisions`;
  });
}

/** (4) Game-state / skill sanity — key resources are present and parseable. */
function checkGameStateSanity(root: string): CheckResult {
  return guarded("game-state-sanity", () => {
    const gameState = join(root, "grimoires", "gygax", "game-state");
    if (!existsSync(gameState) || !statSync(gameState).isDirectory()) {
      throw new Error(`missing game-state dir ${gameState}`);
    }
    // Key skill resources must exist and parse.
    const mustParse = [
      join(root, "skills", "cabal", "resources", "archetypes.yaml"),
      join(root, "scripts", "lib", "archetypes", "schema.yaml"),
    ];
    for (const f of mustParse) {
      if (!existsSync(f)) throw new Error(`missing ${f}`);
      loadYaml(f); // throws on parse failure
    }
    // A game-state index, if present, must parse.
    const index = join(gameState, "index.yaml");
    if (existsSync(index)) loadYaml(index);
    return `game-state present; key skill resources parse`;
  });
}

// ─── Orchestration + rendering ───────────────────────────────────────────────────────────────────

export interface CheckOpts {
  /** Repo root (defaults to the resolved repo root). */
  root?: string;
  /** Built-in archetype roster path (defaults to the FR-2 built-ins). */
  builtinsPath?: string;
  /** User-archetype directory (defaults to grimoires/gygax/archetypes/). Injectable for tests. */
  userDir?: string;
}

/** Run all four sub-checks in fixed order and return the aggregate health summary. */
export function runHealthCheck(opts: CheckOpts = {}): HealthSummary {
  const root = opts.root ?? ROOT;
  const checks = [
    checkGoldenIntegrity(root),
    checkExpectedFindings(root),
    checkArchetypeSchema(opts.builtinsPath ?? DEFAULT_BUILTINS, opts.userDir ?? DEFAULT_USER_DIR),
    checkGameStateSanity(root),
  ];
  return { checks, pass: checks.every((c) => c.pass) };
}

/** Deterministic plain-text health summary (no timestamps). */
export function renderHealthSummary(summary: HealthSummary): string {
  const lines: string[] = ["Gygax diagnostic health — `/gygax check`", ""];
  for (const c of summary.checks) {
    lines.push(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
  }
  lines.push("");
  lines.push(summary.pass ? "OVERALL: PASS — analyst healthy." : "OVERALL: FAIL — see failing checks above.");
  return lines.join("\n");
}

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const summary = runHealthCheck();
  process.stdout.write(renderHealthSummary(summary) + "\n");
  process.exit(summary.pass ? 0 : 1);
}
