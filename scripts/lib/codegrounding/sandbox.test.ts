/**
 * sandbox.test.ts — integration tests for the execution sandbox (Sprint 1, Task 1.7).
 *
 * Covers the Sprint-1 acceptance criteria (grimoires/loa/sprint.md:L76-79):
 *   - reference adapter passes a 4-function round-trip through the sandbox IPC
 *   - wall-clock overrun → fault{timeout}
 *   - memory cap → fault{oom}
 *   - network attempt under deny → fault{network}
 *   - non-JSON-serializable state → hard error (SandboxError NON_SERIALIZABLE)
 *
 * Async (each scenario forks a child). Convention:
 *   `npx tsx scripts/lib/codegrounding/sandbox.test.ts`
 */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { detectDriver } from "./driver-detect.ts";
import { Sandbox, SandboxFault, SandboxError, type FaultKind } from "./sandbox.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "__fixtures__");

function engine(name: string) {
  return join(FIXTURES, name);
}

let passed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL  ${name}:`, e);
    failures.push(name);
  }
}

/** Run a single driver function in a fresh sandbox and return its result. */
async function once(
  name: string,
  fn: string,
  args: unknown[],
  caps: { wallMs: number; memMB: number },
  network: "deny" | "allow" = "deny",
): Promise<unknown> {
  const repoPath = engine(name);
  const det = detectDriver(repoPath);
  if (!det.found) throw new Error(`fixture ${name} has no driver`);
  const box = await Sandbox.start({ repoPath, driverModule: det.module, caps, network });
  try {
    return await box.call(fn, ...args);
  } finally {
    await box.close();
  }
}

/** Assert that a call rejects with a SandboxFault of a specific kind. */
async function expectFault(p: Promise<unknown>, kind: FaultKind): Promise<void> {
  try {
    await p;
    assert.fail(`expected fault{${kind}} but the call resolved`);
  } catch (e) {
    assert.ok(e instanceof SandboxFault, `expected SandboxFault, got ${String(e)}`);
    assert.strictEqual((e as SandboxFault).kind, kind);
  }
}

async function main() {
  console.log("sandbox.ts (integration)\n");

  const NORMAL = { wallMs: 5000, memMB: 256 };

  // ---- contract round-trip ----

  await test("reference adapter: full 4-function round-trip", async () => {
    const repoPath = engine("reference-engine");
    const det = detectDriver(repoPath);
    assert.strictEqual(det.found, true);
    if (!det.found) return;
    const box = await Sandbox.start({ repoPath, driverModule: det.module, caps: NORMAL });
    try {
      const s0 = (await box.call("getInitialState")) as { pile: number; toMove: string };
      assert.deepStrictEqual(s0, { pile: 5, toMove: "a" });

      const actions = (await box.call("legalActions", s0, "a")) as { take: number }[];
      assert.deepStrictEqual(actions, [{ take: 1 }, { take: 2 }, { take: 3 }]);

      const s1 = (await box.call("applyAction", s0, { take: 3 })) as {
        pile: number;
        toMove: string;
      };
      assert.deepStrictEqual(s1, { pile: 2, toMove: "b" });

      assert.strictEqual(await box.call("isTerminal", s1), false);

      const s2 = await box.call("applyAction", s1, { take: 2 });
      assert.strictEqual(await box.call("isTerminal", s2), true);
      assert.deepStrictEqual(await box.call("outcome", s2), { winner: "b" });
    } finally {
      await box.close();
    }
  });

  // ---- fault: timeout ----

  await test("wall-clock overrun → fault{timeout}", async () => {
    await expectFault(
      once("hang-engine", "getInitialState", [], { wallMs: 300, memMB: 256 }),
      "timeout",
    );
  });

  // ---- fault: oom ----

  await test("memory cap → fault{oom}", async () => {
    await expectFault(
      once("oom-engine", "getInitialState", [], { wallMs: 15000, memMB: 64 }),
      "oom",
    );
  });

  // ---- fault: network ----

  await test("network egress under deny → fault{network}", async () => {
    await expectFault(
      once("network-engine", "getInitialState", [], NORMAL, "deny"),
      "network",
    );
  });

  // ---- hard error: non-serializable ----

  await test("non-serializable state → hard SandboxError(NON_SERIALIZABLE)", async () => {
    try {
      await once("nonserializable-engine", "getInitialState", [], NORMAL);
      assert.fail("expected a NON_SERIALIZABLE error");
    } catch (e) {
      assert.ok(e instanceof SandboxError, `expected SandboxError, got ${String(e)}`);
      assert.strictEqual((e as SandboxError).code, "NON_SERIALIZABLE");
    }
  });

  // ---- refusal: driver absent ----

  await test("driver absent → detectDriver refuses with spec (no sandbox start)", async () => {
    const det = detectDriver(engine("no-driver-engine"));
    assert.strictEqual(det.found, false);
    if (!det.found) assert.ok(det.spec.includes("getInitialState"));
  });

  console.log(`\n${passed} passed, ${failures.length} failed.`);
  if (failures.length > 0) {
    console.error("FAILURES:", failures.join(", "));
    process.exit(1);
  }
  console.log("All sandbox integration tests passed.\n");
}

void main();
