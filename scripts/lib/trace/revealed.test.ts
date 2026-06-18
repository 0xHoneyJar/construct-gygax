/**
 * revealed.test.ts — revealed-preference extractor (cycle-012, Sprint 35; FR-1).
 * Convention: `npx tsx scripts/lib/trace/revealed.test.ts`
 *
 * The PTCG fixture must reproduce the pilot ordering ATTACH > EVOLVE > PLAY > ABILITY > ATTACK, with
 * ATTACH's conditional pick-rate = 1.0 (the false-choice-in-practice). Output must be deterministic.
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus } from "./decision.ts";
import { extractRevealed, rateOf } from "./revealed.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "__fixtures__", "ptcg-revealed");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    process.exit(1);
  }
}

const corpus = loadCorpus(FIXTURE);
const rp = extractRevealed(corpus);

test("revealed ordering is ATTACH > EVOLVE > PLAY > ABILITY > ATTACK", () => {
  assert.deepEqual(rp.overall.ordering, ["ATTACH", "EVOLVE", "PLAY", "ABILITY", "ATTACK"]);
});

test("ATTACH is the revealed #1 (the headline finding)", () => {
  assert.equal(rp.overall.ordering[0], "ATTACH");
});

test("ATTACH conditional pick-rate is 1.0 (false-choice-in-practice)", () => {
  assert.equal(rateOf(rp.overall, "ATTACH"), 1);
  // and it strictly dominates the next type's rate
  assert.ok(rateOf(rp.overall, "ATTACH") > rateOf(rp.overall, "EVOLVE"));
});

test("ATTACH beats every co-offered type it meets (pairwise 100%)", () => {
  for (const cell of rp.overall.pairwise) {
    if (cell.a === "ATTACH") assert.equal(cell.bOverA, 0, `ATTACH should never lose to ${cell.b}`);
    if (cell.b === "ATTACH") assert.equal(cell.aOverB, 0, `ATTACH should never lose to ${cell.a}`);
  }
});

test("segment 'tier:expert' carries the whole corpus", () => {
  assert.equal(rp.segments.length, 1);
  assert.equal(rp.segments[0].segment, "tier:expert");
  assert.equal(rp.segments[0].n, 8);
});

test("extraction is deterministic (byte-identical across runs)", () => {
  const a = JSON.stringify(extractRevealed(loadCorpus(FIXTURE)));
  const b = JSON.stringify(extractRevealed(loadCorpus(FIXTURE)));
  assert.equal(a, b);
});

console.log("revealed.test.ts: all passed");
