/**
 * vendor.test.ts — sha256 pin self-check + live drift leg for evals/vendor/arneson/
 * (cycle-009 Sprint 3, Task 3.4; sdd §3.3/§6 — OQ-1 vendor-with-pin).
 * Convention: `npx tsx evals/vendor/vendor.test.ts`
 *
 * Hermetic leg (always-on, CI-truth): recompute sha256 (node:crypto) of every vendored file
 * against VENDOR.yaml and fail on mismatch — edits to vendored bytes cannot land silently.
 * Also fails on any UNPINNED file under fixtures/ (100% of vendored files sha256-pinned).
 *
 * Live drift leg (skip-if-absent BONUS): byte-diff every vendored copy against a discovered
 * sibling checkout (GYGAX_ARNESON_ROOT env, else ../construct-arneson next to the repo root)
 * and fail loudly with a re-vendor instruction. It NEVER auto-updates the pin — the pin is
 * the honesty device (sdd §6: "cross-repo errors are briefs, not exceptions").
 */
import assert from "node:assert";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // evals/vendor
const REPO = resolve(HERE, "..", "..");
const VENDOR_YAML = join(HERE, "arneson", "VENDOR.yaml");
const FIXTURES_ROOT = join(HERE, "arneson", "fixtures");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

interface VendorEntry {
  vendored: string; // repo-root-relative
  upstream_path: string; // sibling-root-relative
  sha256: string;
}
interface VendorPin {
  upstream: { repo: string; git_sha: string; vendored_at: string };
  files: VendorEntry[];
}

// yq loader convention (payoff/index.ts:18, ladder/index.ts:31, grade.ts:42)
const pin = JSON.parse(execFileSync("yq", ["-o=json", ".", VENDOR_YAML], { encoding: "utf8" })) as VendorPin;

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

function listFiles(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(root, relPath));
    else out.push(relPath);
  }
  return out.sort();
}

console.log("vendor — VENDOR.yaml pin self-check (hermetic)\n");

test("pin metadata: upstream repo + git_sha + vendored_at present", () => {
  assert.strictEqual(pin.upstream.repo, "0xHoneyJar/construct-arneson");
  assert.match(pin.upstream.git_sha, /^[0-9a-f]{40}$/);
  assert.match(pin.upstream.vendored_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(pin.files.length >= 16, `expected the full dungeon slice, got ${pin.files.length} entries`);
});

test("every pinned file exists and its recomputed sha256 matches VENDOR.yaml", () => {
  for (const f of pin.files) {
    const path = join(REPO, f.vendored);
    assert.ok(existsSync(path), `pinned file missing on disk: ${f.vendored}`);
    const actual = sha256(path);
    assert.strictEqual(
      actual,
      f.sha256,
      `sha256 mismatch for ${f.vendored}\n  pinned:   ${f.sha256}\n  computed: ${actual}\n` +
        "  Vendored bytes are ARNESON'S FILES and must not be edited here. If upstream moved, " +
        "re-vendor: copy the upstream files byte-exact and update VENDOR.yaml (git_sha, " +
        "vendored_at, sha256 entries), then re-derive the pinned conformance verdict.",
    );
  }
});

test("every file under fixtures/ is pinned (no unpinned strays can ride along)", () => {
  const onDisk = listFiles(FIXTURES_ROOT).map((rel) => `evals/vendor/arneson/fixtures/${rel}`);
  const pinned = new Set(pin.files.map((f) => f.vendored));
  const strays = onDisk.filter((p) => !pinned.has(p));
  assert.deepStrictEqual(strays, [], `unpinned files under evals/vendor/arneson/fixtures/: ${strays.join(", ")}`);
});

// ---- live drift leg (skip-if-absent bonus — CI never needs the sibling, NFR-3) ----

console.log("\nvendor — live drift leg vs sibling checkout (skip-if-absent)\n");

function resolveSibling(): string | null {
  const env = process.env.GYGAX_ARNESON_ROOT;
  if (env) return existsSync(env) ? env : null; // explicit env var is authoritative
  const sibling = resolve(REPO, "..", "construct-arneson");
  return existsSync(sibling) ? sibling : null;
}

const sibling = resolveSibling();
if (!sibling) {
  console.log("  SKIP  no sibling checkout (set GYGAX_ARNESON_ROOT or place ../construct-arneson) — hermetic pins above are CI-truth");
} else {
  test(`vendored copies byte-identical to sibling at ${sibling} (never auto-updated)`, () => {
    const drifted: string[] = [];
    for (const f of pin.files) {
      const upstream = join(sibling, f.upstream_path);
      if (!existsSync(upstream) || !readFileSync(join(REPO, f.vendored)).equals(readFileSync(upstream))) {
        drifted.push(f.vendored);
      }
    }
    assert.deepStrictEqual(
      drifted,
      [],
      `vendored copies drifted from the live sibling: ${drifted.join(", ")}\n` +
        "  This test NEVER auto-updates the pin. To re-vendor deliberately: copy the upstream " +
        "files byte-exact into evals/vendor/arneson/fixtures/, update VENDOR.yaml (upstream.git_sha " +
        "= sibling HEAD, vendored_at = that commit's date, per-file sha256), and re-derive the " +
        "pinned conformance verdict in evals/vendor/conformance.test.ts against the new bytes.",
    );
  });
}

console.log("\nvendor.test.ts: all tests passed");
