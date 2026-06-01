/**
 * driver-detect.ts — the `gygaxDriver` contract + convention-based detector
 *
 * Sprint 1, Tasks 1.2 / 1.3 (grimoires/loa/sprint.md:L86-87; SDD §5.2, §5.4).
 *
 * The contract — NOT API auto-discovery — is the ONLY way Gygax drives a target engine
 * (SDD §5.1). State and Action MUST be JSON-serializable: they cross the child_process
 * boundary as data (prd.md:L229). When no driver is present, Gygax refuses for a digital
 * engine and prints the exact spec (no silent fallback — that is only for no-repo/tabletop).
 *
 * Runs in both parent (tsx) and the sandbox child (plain `node` native type-stripping),
 * so relative imports use explicit `.ts` extensions and only `node:` builtins are imported.
 */
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * The driver contract a target engine must export as `gygaxDriver`.
 * State and Action MUST be JSON-serializable (prd.md:L229, SDD §5.2).
 */
export interface GygaxDriver<State, Action> {
  getInitialState(): State;
  legalActions(state: State, actor: string): Action[];
  applyAction(state: State, action: Action): State; // -> newState
  isTerminal(state: State): boolean;
  outcome(state: State): unknown; // defined when isTerminal(state) === true
}

/** The functions every conformant driver must implement. */
export const DRIVER_FUNCTIONS = [
  "getInitialState",
  "legalActions",
  "applyAction",
  "isTerminal",
  "outcome",
] as const;

/**
 * Detection convention (OQ-3, resolved here): the target repo exports a `gygaxDriver`
 * constant from a file named `gygax.driver.{ts,mjs,js}`, at the repo root or under `src/`.
 * First existing candidate wins. This is a fixed, human-declared convention precisely so
 * the LLM never has to guess the engine's step function at runtime (SDD §5.1).
 */
export const DRIVER_CANDIDATE_PATHS = [
  "gygax.driver.ts",
  "gygax.driver.mjs",
  "gygax.driver.js",
  "src/gygax.driver.ts",
  "src/gygax.driver.mjs",
  "src/gygax.driver.js",
] as const;

/**
 * The exact spec printed in the refusal message when no driver is found (prd.md:L230-231,
 * SDD §5.2). Kept verbatim so the human can implement it directly.
 */
export const DRIVER_SPEC = `Gygax needs a headless driver to run this engine, and none was found.

Export a \`gygaxDriver\` constant from \`gygax.driver.ts\` (repo root or \`src/\`)
implementing this exact contract:

  export interface GygaxDriver<State, Action> {
    // State and Action MUST be JSON-serializable (they cross the sandbox boundary as data).
    getInitialState(): State;
    legalActions(state: State, actor: string): Action[];
    applyAction(state: State, action: Action): State;   // -> newState
    isTerminal(state: State): boolean;
    outcome(state: State): unknown;                       // defined when isTerminal(state)
  }

  export const gygaxDriver: GygaxDriver<YourState, YourAction> = { /* ... */ };

Writing this adapter is itself a useful sanity check: it forces an honest declaration of the
engine's real step function. Gygax will not guess it.`;

export type DetectResult =
  | { found: true; module: string }
  | { found: false; spec: string };

/**
 * Probe `repoPath` for the conventional driver module.
 * @returns `{ found: true, module }` with the absolute path, or `{ found: false, spec }`
 *          carrying the exact refusal spec (SDD §5.4).
 */
export function detectDriver(repoPath: string): DetectResult {
  const root = resolve(repoPath);
  for (const rel of DRIVER_CANDIDATE_PATHS) {
    const abs = join(root, rel);
    if (existsSync(abs)) return { found: true, module: abs };
  }
  return { found: false, spec: DRIVER_SPEC };
}

export type ValidateResult =
  | { ok: true; driver: GygaxDriver<unknown, unknown> }
  | { ok: false; missing: string[] };

/**
 * Validate that a loaded module exposes a shape-conformant `gygaxDriver` export.
 * Shape-only (presence of the 5 functions); behavioral correctness is the adapter's job.
 */
export function validateDriverShape(mod: unknown): ValidateResult {
  const driver = (mod as { gygaxDriver?: unknown } | null | undefined)?.gygaxDriver;
  if (!driver || typeof driver !== "object") {
    return { ok: false, missing: ["gygaxDriver export"] };
  }
  const d = driver as Record<string, unknown>;
  const missing = DRIVER_FUNCTIONS.filter((fn) => typeof d[fn] !== "function");
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, driver: driver as GygaxDriver<unknown, unknown> };
}

// CLI: `npx tsx scripts/lib/codegrounding/driver-detect.ts <repoPath>` prints found/refusal.
// Matches the repo convention (scripts/MANIFEST.yaml) of a runnable module entrypoint.
if (process.argv[1]?.endsWith("driver-detect.ts")) {
  const repoPath = process.argv[2] ?? process.cwd();
  const result = detectDriver(repoPath);
  if (result.found) {
    process.stdout.write(`found driver: ${result.module}\n`);
  } else {
    process.stdout.write(result.spec + "\n");
    process.exitCode = 1;
  }
}
