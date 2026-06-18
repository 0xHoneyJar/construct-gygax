/**
 * decision.test.ts — decision-trace/v1 validation + loader (cycle-012, Sprint 35; FR-1).
 * Convention: `npx tsx scripts/lib/trace/decision.test.ts`
 *
 * Every rejection must be a TraceError carrying the source file path. The producer-bound claim rule
 * is the shared one from sidecar.ts (a simulation may not tag itself observed).
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateDecisionTrace, loadCorpus, TraceError } from "./decision.ts";

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

const FILE = "decisions/d01.json";

function golden(): any {
  return {
    schema: "decision-trace/v1",
    claim_strength: "real-agent-observed",
    producer: { kind: "real-agent", id: "ptcg-top-pilots" },
    corpus: { id: "ptcg-bellibolt-pilots", game: "ptcg-abc" },
    actor_id: "onechan1",
    episode_id: "ep-1",
    t: 1,
    context: { segment: "tier:expert", phase: "main" },
    offered: [{ type: "ATTACH" }, { type: "EVOLVE" }, { type: "ATTACK" }],
    chosen: [{ type: "ATTACH" }],
  };
}

test("valid record validates and round-trips", () => {
  const r = validateDecisionTrace(golden(), FILE);
  assert.equal(r.schema, "decision-trace/v1");
  assert.equal(r.claim_strength, "real-agent-observed");
  assert.equal(r.chosen[0].type, "ATTACH");
  assert.equal(r.context.segment, "tier:expert");
});

function rejects(name: string, mutate: (g: any) => void, needle: string) {
  test(`rejects: ${name}`, () => {
    const g = golden();
    mutate(g);
    assert.throws(
      () => validateDecisionTrace(g, FILE),
      (e: unknown) => {
        assert.ok(e instanceof TraceError, "must be a TraceError");
        assert.ok((e as Error).message.startsWith(`${FILE}: `), "carries the file path");
        assert.ok((e as Error).message.includes(needle), `mentions ${JSON.stringify(needle)}: ${(e as Error).message}`);
        return true;
      },
    );
  });
}

rejects("wrong schema", (g) => (g.schema = "observed-trace/v1"), "unknown schema");
rejects("empty offered", (g) => (g.offered = []), "offered must be a non-empty array");
rejects("empty chosen", (g) => (g.chosen = []), "chosen must be a non-empty array");
rejects("chosen not in offered", (g) => (g.chosen = [{ type: "PLAY" }]), "chosen ⊄ offered");
rejects("missing segment", (g) => delete g.context.segment, "context.segment must be a non-empty string");
rejects(
  "simulation laundering as observed",
  (g) => {
    g.producer.kind = "simulation";
    // claim_strength stays "real-agent-observed" → must be rejected (producer-bound rule)
  },
  "producer-bound",
);
rejects("unknown provenance key", (g) => (g.producer.provenance = { not_a_key: "x" }), "not a known provenance field");

test("loadCorpus reads the PTCG fixture (8 records, uniform claim)", () => {
  const c = loadCorpus(FIXTURE);
  assert.equal(c.records.length, 8);
  assert.equal(c.claim, "real-agent-observed");
  assert.equal(c.id, "ptcg-bellibolt-pilots");
  assert.equal(c.game, "ptcg-abc");
});

console.log("decision.test.ts: all passed");
