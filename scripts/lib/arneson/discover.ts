/**
 * discover.ts — reciprocal sibling discovery (cycle-009, Sprint 4; FR-5.1, S5).
 *
 * The mirror of Arneson's `discover_engine.py`: an explicit `GYGAX_ARNESON_ROOT` is
 * AUTHORITATIVE — if it is set but invalid, that is null, never a silent fall-through to the
 * sibling probe (a misconfigured env var that "works anyway" hides the misconfiguration).
 * Otherwise the conventional sibling `../construct-gygax` geometry is probed in reverse.
 *
 * A root is valid iff `<root>/grimoires/arneson/playouts` exists (the dir marker — the only
 * thing this module reads). Absence is a STATE, not an error: callers render nothing.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYOUTS_MARKER = join("grimoires", "arneson", "playouts");

/** A candidate root is valid iff it carries the playouts dir marker; else null. */
export function validateRoot(root: string): string | null {
  const abs = resolve(root);
  return existsSync(join(abs, PLAYOUTS_MARKER)) ? abs : null;
}

function valid(root: string): boolean {
  return validateRoot(root) !== null;
}

/** Resolve the sibling construct-arneson root, or null (graceful absence, never an error). */
export function resolveArnesonRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.GYGAX_ARNESON_ROOT;
  if (explicit !== undefined && explicit !== "") {
    const root = resolve(explicit);
    return valid(root) ? root : null; // authoritative: no silent fall-through
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const sibling = resolve(repoRoot, "..", "construct-arneson");
  return valid(sibling) ? sibling : null;
}
