/**
 * drift-reconciler.ts — F1 Drift Reconciler (Sprint 2, Task 2.2)
 *
 * grimoires/loa/sprint.md:L145; SDD §1.4, §3.2, §5.4.
 *
 * Three-way reconcile (modeled on /ride): code reality (StructuralMap) vs the hand-authored
 * `game-state/` model vs design intent. Produces a DriftReport of numeric + structural deltas,
 * EVERY structural claim carrying a `source` citation; uncertain wiring is demoted to
 * `silentOn`, never asserted (prd.md:L176, L251-252; SDD §3.2 invariant).
 *
 * Honesty rule: we only assert deltas for things we can cite. A code loop we traced that the
 * game-state model doesn't record IS a citable structural delta. We do NOT claim "the code
 * lacks X" for a relationship game-state has but our trace didn't see — absence of evidence is
 * not evidence of absence when wiring may be untraceable (precision over recall).
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import type { StructuralMap } from "./static-analyzer.ts";

export interface NumericDelta {
  field: string;
  code: number;
  gameState: number;
  source: string;
  leads: "undecided" | "code" | "gameState";
}
export interface StructuralDelta {
  claim: string;
  inCode: boolean;
  inGameState: boolean;
  source: string; // INVARIANT: always present (SDD §3.2)
  confidence: "certain";
}
export interface DriftReport {
  numericDeltas: NumericDelta[];
  structuralDeltas: StructuralDelta[];
  silentOn: string[];
}

/** Normalized game-state extract used for comparison. */
export interface GameStateModel {
  numbers: { name: string; value: number }[];
  relationships: { from: string; to: string }[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".beads"]);
const RELATIONSHIP_KEYS = new Set(["relationships", "loops", "edges", "interactions"]);

/** Reduce a name to its comparable core: last path segment, alphanumeric, lowercased. */
function norm(name: string): string {
  const last = name.split(/[.\s/]+/).pop() ?? name;
  return last.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readDataFile(file: string): unknown {
  const ext = extname(file);
  if (ext === ".json") {
    return JSON.parse(readFileSync(file, "utf8"));
  }
  if (ext === ".yaml" || ext === ".yml") {
    // YAML support via yq (no in-process YAML dependency). Skipped if yq is unavailable.
    try {
      const json = execFileSync("yq", ["-o=json", "eval", ".", file], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
}

function collectDataFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const full = join(dir, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) collectDataFiles(full, out);
    else if ([".json", ".yaml", ".yml"].includes(extname(full))) out.push(full);
  }
}

/**
 * Load + normalize a game-state directory into a comparable model.
 * Supports JSON natively and YAML via `yq`. Numeric leaves become `numbers`; any array under a
 * relationship key whose items have `from` + `to` becomes `relationships`.
 */
export function loadGameState(gameStateDir: string): GameStateModel {
  const files: string[] = [];
  collectDataFiles(gameStateDir, files);

  const numbers: { name: string; value: number }[] = [];
  const relationships: { from: string; to: string }[] = [];

  for (const file of files) {
    const data = readDataFile(file);
    if (data == null) continue;
    const walk = (val: unknown, key: string): void => {
      if (typeof val === "number") {
        numbers.push({ name: key, value: val });
      } else if (Array.isArray(val)) {
        if (RELATIONSHIP_KEYS.has(norm(key))) {
          for (const item of val) {
            if (item && typeof item === "object") {
              const o = item as Record<string, unknown>;
              if (typeof o.from === "string" && typeof o.to === "string") {
                relationships.push({ from: o.from, to: o.to });
              }
            }
          }
        }
        val.forEach((v, i) => walk(v, `${key}.${i}`));
      } else if (val && typeof val === "object") {
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          walk(v, key ? `${key}.${k}` : k);
        }
      }
    };
    walk(data, "");
  }
  return { numbers, relationships };
}

/** Pure reconciliation of a StructuralMap against an already-loaded GameStateModel. */
export function reconcileModel(map: StructuralMap, gs: GameStateModel): DriftReport {
  // ---- numeric deltas: matched normalized names with differing values (precision) ----
  const gsByNorm = new Map<string, number>();
  for (const n of gs.numbers) {
    if (!gsByNorm.has(norm(n.name))) gsByNorm.set(norm(n.name), n.value);
  }
  const numericDeltas: NumericDelta[] = [];
  const seenNumeric = new Set<string>();
  for (const codeNum of map.numbers) {
    const key = norm(codeNum.name);
    if (!gsByNorm.has(key)) continue; // present only in code → not a drift claim (precision)
    const gsVal = gsByNorm.get(key)!;
    if (gsVal === codeNum.value) continue; // agree
    const dedup = `${key}@${codeNum.source}`;
    if (seenNumeric.has(dedup)) continue;
    seenNumeric.add(dedup);
    numericDeltas.push({
      field: codeNum.name,
      code: codeNum.value,
      gameState: gsVal,
      source: codeNum.source,
      leads: "undecided", // human decides which side leads (prd.md:L176)
    });
  }

  // ---- structural deltas: traced code loops the game-state model doesn't record ----
  const gsRel = new Set(gs.relationships.map((r) => `${norm(r.from)}->${norm(r.to)}`));
  const structuralDeltas: StructuralDelta[] = [];
  for (const loop of map.loops) {
    const inGameState = gsRel.has(`${norm(loop.from)}->${norm(loop.to)}`);
    if (inGameState) continue; // agreement — no drift to report
    structuralDeltas.push({
      claim: `${loop.from} → ${loop.to}`,
      inCode: true,
      inGameState: false,
      source: loop.source, // INVARIANT: a traced loop always has a citation
      confidence: loop.confidence,
    });
  }

  const silentOn = map.untraceable.map((u) => `${u.site} (${u.reason}) — not asserted`);

  return { numericDeltas, structuralDeltas, silentOn };
}

/** Reconcile a StructuralMap against a game-state directory on disk. */
export function reconcile(map: StructuralMap, gameStateDir: string): DriftReport {
  return reconcileModel(map, loadGameState(gameStateDir));
}

// CLI: `npx tsx scripts/lib/codegrounding/drift-reconciler.ts <repoPath> <gameStateDir>`
if (process.argv[1]?.endsWith("drift-reconciler.ts")) {
  const repoPath = process.argv[2];
  const gameStateDir = process.argv[3];
  if (!repoPath || !gameStateDir) {
    process.stderr.write("usage: drift-reconciler.ts <repoPath> <gameStateDir>\n");
    process.exit(2);
  }
  // Lazy import to keep the analyzer optional for pure-model callers.
  import("./static-analyzer.ts").then(({ analyze }) => {
    process.stdout.write(JSON.stringify(reconcile(analyze(repoPath), gameStateDir), null, 2) + "\n");
  });
}
