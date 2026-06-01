/**
 * patch-emitter.ts — F4 Patch Emitter (Sprint 4, Tasks 4.1 / 4.2)
 *
 * grimoires/loa/sprint.md:L257-258; SDD §1.4 (Patch Emitter), §5.4.
 *
 * Emits a `git apply`-able unified diff as a SUGGESTION artifact. Gygax NEVER writes to source
 * and NEVER auto-applies — application is always a separate human/Arneson step (prd.md:L202,L205).
 * This is the security-relevant identity invariant (SDD §1.9).
 *
 * Certainty gate (the F4↔F1 contract): a **logic** diff (TS engine code) is only allowed for
 * wiring F1 actually traced (`traced=true`); a logic diff on wiring F1 stayed silent on is
 * REFUSED. **Data/JSON** diffs are unrestricted (prd.md:L203-204).
 *
 * Diffs are generated via `git diff --no-index` (git is already required) so they are exactly
 * git-compatible, then validated with `git apply --check` before being presented (R-8).
 */
import { writeFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import type { StructuralMap } from "./static-analyzer.ts";

export type PatchKind = "data" | "logic";

export interface PatchTarget {
  /** Repo-relative path of the file the diff applies to (e.g. "src/combat/clash.ts"). */
  file: string;
  /** "data" = JSON/data table (unrestricted); "logic" = TS engine code (certainty-gated). */
  kind: PatchKind;
  /** Current file content. */
  oldText: string;
  /** Proposed file content. */
  newText: string;
}

export interface UnifiedDiff {
  file: string;
  /** git apply-able unified diff text; empty string when old === new. */
  diff: string;
}

/** Thrown when a logic diff is requested for wiring F1 did not trace (the certainty gate). */
export class UntracedLogicPatchError extends Error {
  constructor(file: string) {
    super(
      `refusing to emit a LOGIC diff for ${file}: F1 did not trace this wiring (traced=false). ` +
        `Gygax only suggests logic changes to code it actually understands; it stays silent on ` +
        `wiring it could not trace (prd.md:L203-204). Data/JSON patches are unrestricted.`,
    );
    this.name = "UntracedLogicPatchError";
  }
}

function rewriteHeaderPaths(diff: string, file: string): string {
  const rel = file.replace(/^\/+/, "");
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("--- ")) return `--- a/${rel}`;
      if (line.startsWith("+++ ")) return `+++ b/${rel}`;
      if (line.startsWith("diff --git ")) return `diff --git a/${rel} b/${rel}`;
      return line;
    })
    .join("\n");
}

/**
 * Build a unified diff for `target`. Logic diffs are gated by `traced`.
 * @throws UntracedLogicPatchError if `target.kind === "logic"` and `traced === false`.
 */
export function emitPatch(target: PatchTarget, traced: boolean): UnifiedDiff {
  if (target.kind === "logic" && !traced) {
    throw new UntracedLogicPatchError(target.file);
  }
  if (target.oldText === target.newText) {
    return { file: target.file, diff: "" };
  }

  const dir = mkdtempSync(join(tmpdir(), "gygax-patch-"));
  try {
    const oldF = join(dir, "old");
    const newF = join(dir, "new");
    writeFileSync(oldF, target.oldText);
    writeFileSync(newF, target.newText);
    let out = "";
    try {
      out = execFileSync("git", ["diff", "--no-index", "--unified=3", oldF, newF], {
        encoding: "utf8",
      });
    } catch (e) {
      // `git diff --no-index` exits 1 when there ARE differences — that's success for us.
      out = (e as { stdout?: string }).stdout ?? "";
    }
    if (!out.trim()) return { file: target.file, diff: "" };
    return { file: target.file, diff: rewriteHeaderPaths(out, target.file) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Extract the `a/<path>` source files a diff touches (excluding /dev/null creations). */
function diffSourceFiles(diff: string): string[] {
  const files: string[] = [];
  for (const line of diff.split("\n")) {
    const m = /^--- a\/(.+)$/.exec(line);
    if (m && m[1] !== "/dev/null") files.push(m[1]);
  }
  return files;
}

/**
 * Validate a diff with `git apply --check` against repoDir's actual file content (R-8).
 *
 * IMPORTANT: we validate inside an ISOLATED throwaway git tree containing only copies of the
 * target files, NOT directly in repoDir. Running `git apply` inside an outer repo resolves
 * `a/<path>` against that repo's toplevel (not cwd), which can spuriously pass when repoDir is a
 * subdir. The isolated tree makes path resolution + content matching correct and deterministic.
 */
export function validatePatch(diff: string, repoDir: string): boolean {
  if (!diff.trim()) return true; // empty diff is trivially applicable (no-op)
  const tmp = mkdtempSync(join(tmpdir(), "gygax-validate-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: tmp });
    for (const rel of diffSourceFiles(diff)) {
      const src = join(repoDir, rel);
      const dest = join(tmp, rel);
      mkdirSync(dirname(dest), { recursive: true });
      if (existsSync(src)) copyFileSync(src, dest); // absent → creation patch; leave dest absent
    }
    execFileSync("git", ["apply", "--check", "-p1"], {
      cwd: tmp,
      input: diff,
      stdio: ["pipe", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Certainty helper: did F1 trace any wiring in `file`? A logic patch to such a file is allowed;
 * a logic patch to a file F1 stayed silent on is refused (drives `traced` for emitPatch).
 */
export function isLogicTraced(map: StructuralMap, file: string): boolean {
  const rel = file.replace(/^\/+/, "");
  return map.loops.some((l) => l.source.split(":")[0].endsWith(rel) || rel.endsWith(l.source.split(":")[0]));
}

// CLI: not a standalone runner — F4 is driven by homebrew-apply.ts (which composes F1 + this).
