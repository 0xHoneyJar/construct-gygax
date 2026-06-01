/**
 * patch-emitter.test.ts — F4 unit/contract tests (Sprint 4, Tasks 4.1–4.3).
 *
 * Sprint 4 ACs (grimoires/loa/sprint.md:L246-249):
 *   - output is a reviewable unified diff; Gygax never mutates source in place
 *   - logic diffs limited to traced code; refused when traced=false; data/JSON unrestricted
 *   - every emitted diff passes `git apply --check` before being presented
 *
 * Convention: `npx tsx scripts/lib/codegrounding/patch-emitter.test.ts`
 */
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { emitPatch, validatePatch, isLogicTraced, UntracedLogicPatchError } from "./patch-emitter.ts";
import { analyze } from "./static-analyzer.ts";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, "__fixtures__", "drift-engine");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

/** Make a throwaway git working tree with one file at `relPath` containing `content`. */
function gitTreeWith(relPath: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "gygax-apply-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  const full = join(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return dir;
}

console.log("patch-emitter.ts (F4)\n");

const DATA_OLD = '{\n  "fire": { "base_damage": 12 }\n}\n';
const DATA_NEW = '{\n  "fire": { "base_damage": 10 }\n}\n';

test("data diff: emitted, applies cleanly via git apply --check, then applies to newText", () => {
  const rel = "src/affinities.json";
  const { diff } = emitPatch({ file: rel, kind: "data", oldText: DATA_OLD, newText: DATA_NEW }, false);
  assert.ok(diff.includes(`--- a/${rel}`), "header not rewritten to target file");
  assert.ok(diff.includes(`+++ b/${rel}`));
  assert.ok(/^-.*"base_damage": 12/m.test(diff), "missing removed line");
  assert.ok(/^\+.*"base_damage": 10/m.test(diff), "missing added line");

  const tree = gitTreeWith(rel, DATA_OLD);
  try {
    assert.strictEqual(validatePatch(diff, tree), true, "git apply --check rejected the diff");
    // apply for real and confirm the result
    execFileSync("git", ["apply", "-p1"], { cwd: tree, input: diff });
    assert.strictEqual(readFileSync(join(tree, rel), "utf8"), DATA_NEW);
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

test("data diff: traced flag is irrelevant (unrestricted)", () => {
  const r = emitPatch({ file: "x.json", kind: "data", oldText: "a\n", newText: "b\n" }, false);
  assert.ok(r.diff.includes("+b"));
});

const LOGIC_OLD = "export const FIRE_BASE_DAMAGE = 12;\n";
const LOGIC_NEW = "export const FIRE_BASE_DAMAGE = 10;\n";

test("logic diff with traced=true: emitted + git apply --check passes", () => {
  const rel = "src/combat.ts";
  const { diff } = emitPatch({ file: rel, kind: "logic", oldText: LOGIC_OLD, newText: LOGIC_NEW }, true);
  assert.ok(diff.includes(`--- a/${rel}`));
  const tree = gitTreeWith(rel, LOGIC_OLD);
  try {
    assert.strictEqual(validatePatch(diff, tree), true);
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

test("CERTAINTY GATE: logic diff with traced=false is REFUSED", () => {
  assert.throws(
    () => emitPatch({ file: "src/combat.ts", kind: "logic", oldText: LOGIC_OLD, newText: LOGIC_NEW }, false),
    (e: unknown) => e instanceof UntracedLogicPatchError,
  );
});

test("isLogicTraced reflects F1's trace: traced file true, untraced file false", () => {
  const map = analyze(ENGINE);
  // combat.ts has a certain traced loop (resolveClash → applyCondition)
  assert.strictEqual(isLogicTraced(map, "src/combat.ts"), true);
  // a file F1 never traced
  assert.strictEqual(isLogicTraced(map, "src/never-seen.ts"), false);
});

test("no in-place mutation: emitPatch returns text and does not touch the target file", () => {
  // emitPatch operates only on the provided strings + a temp dir; there is no real file to mutate.
  // Prove it by emitting against a path that does not exist — it must still succeed (pure text).
  const r = emitPatch(
    { file: "does/not/exist.json", kind: "data", oldText: "1\n", newText: "2\n" },
    false,
  );
  assert.ok(r.diff.includes("+2"));
});

test("validatePatch REJECTS a diff whose context does not match the real file", () => {
  const rel = "src/affinities.json";
  // diff built from a fictional old content "x" → "y"
  const { diff } = emitPatch({ file: rel, kind: "data", oldText: "x\n", newText: "y\n" }, false);
  // ...but the real working tree has the genuine JSON content
  const tree = gitTreeWith(rel, DATA_OLD);
  try {
    assert.strictEqual(validatePatch(diff, tree), false, "non-matching patch wrongly validated");
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

test("validatePatch REJECTS a patch for a file absent from the repo", () => {
  const { diff } = emitPatch({ file: "src/ghost.ts", kind: "data", oldText: "a\n", newText: "b\n" }, false);
  const tree = gitTreeWith("src/other.ts", "unrelated\n"); // ghost.ts not present
  try {
    assert.strictEqual(validatePatch(diff, tree), false, "patch for absent file wrongly validated");
  } finally {
    rmSync(tree, { recursive: true, force: true });
  }
});

test("identical old/new yields an empty (no-op) diff", () => {
  const r = emitPatch({ file: "a.ts", kind: "logic", oldText: "x\n", newText: "x\n" }, true);
  assert.strictEqual(r.diff, "");
  assert.strictEqual(validatePatch(r.diff, tmpdir()), true);
});

console.log("\nAll F4 patch-emitter tests passed.\n");
