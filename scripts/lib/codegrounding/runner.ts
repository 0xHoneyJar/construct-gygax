/**
 * runner.ts — the sandbox CHILD entrypoint
 *
 * Sprint 1, Tasks 1.4 / 1.6 (grimoires/loa/sprint.md:L88,L90; SDD §1.4, §5.3, §6.1).
 *
 * Runs under plain `node` (native type-stripping) as a forked child of sandbox.ts. It:
 *   1. installs the network-deny shim (unless network: "allow") BEFORE loading the adapter,
 *   2. dynamically imports the adapter and validates the `gygaxDriver` shape,
 *   3. answers `call` requests by invoking driver functions, enforcing the JSON-serializable
 *      state contract, and classifying failures into the IPC fault/error protocol (SDD §5.3).
 *
 * No LLM is ever in this loop — resolution is purely mechanical (SDD §5.1, prd.md:L214-215).
 * Relative imports use explicit `.ts` extensions so plain `node` resolves them.
 */
import { pathToFileURL } from "node:url";
import { installNetworkDeny, NET_DENY_CODE } from "./net-deny.ts";
import { validateDriverShape, type GygaxDriver } from "./driver-detect.ts";

type InitMsg = {
  type: "init";
  repoPath: string;
  driverModule: string;
  network: "deny" | "allow";
};
type CallMsg = { type: "call"; fn: string; args: unknown[] };
type InboundMsg = InitMsg | CallMsg;

let driver: GygaxDriver<unknown, unknown> | null = null;

function send(msg: unknown): void {
  process.send?.(msg);
}

function hasNetDenyCode(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === NET_DENY_CODE;
}

function describe(e: unknown): string {
  const err = e as { stack?: string; message?: string } | null;
  return String(err?.stack ?? err?.message ?? e);
}

/**
 * Round-trip a value through JSON. Returns the parsed clone, or throws if the value is not
 * JSON-serializable — a HARD error (SDD §6.1): the adapter author must return serializable
 * state. `undefined` is normalized to `null` (valid for `outcome()` before terminal).
 */
function jsonRoundTrip(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return null; // undefined / function / symbol top-level
  return JSON.parse(serialized);
}

async function handleInit(msg: InitMsg): Promise<void> {
  if (msg.network !== "allow") installNetworkDeny();
  let mod: unknown;
  try {
    mod = await import(pathToFileURL(msg.driverModule).href);
  } catch (e) {
    send({ type: "error", code: "DRIVER_LOAD_FAILED", message: describe(e) });
    return;
  }
  const v = validateDriverShape(mod);
  if (!v.ok) {
    send({
      type: "error",
      code: "DRIVER_INVALID",
      message: `adapter at ${msg.driverModule} is missing: ${v.missing.join(", ")}`,
    });
    return;
  }
  driver = v.driver;
  send({ type: "ready" });
}

async function handleCall(msg: CallMsg): Promise<void> {
  if (!driver) {
    send({ type: "error", code: "NOT_READY", message: "call received before driver ready" });
    return;
  }
  const fn = (driver as Record<string, unknown>)[msg.fn];
  if (typeof fn !== "function") {
    send({ type: "error", code: "NO_SUCH_FN", message: `driver has no function "${msg.fn}"` });
    return;
  }

  let value: unknown;
  try {
    value = await (fn as (...a: unknown[]) => unknown).apply(driver, msg.args ?? []);
  } catch (e) {
    if (hasNetDenyCode(e)) {
      send({ type: "fault", kind: "network", detail: describe(e) });
    } else {
      send({ type: "fault", kind: "throw", detail: describe(e) });
    }
    return;
  }

  let clone: unknown;
  try {
    clone = jsonRoundTrip(value);
  } catch {
    send({
      type: "error",
      code: "NON_SERIALIZABLE",
      message:
        `driver.${msg.fn}() returned a value that is not JSON-serializable. ` +
        `Adapters MUST return JSON-serializable state/action — it crosses the sandbox ` +
        `boundary as data (prd.md:L229).`,
    });
    return;
  }
  send({ type: "result", value: clone });
}

process.on("message", (raw: unknown) => {
  const msg = raw as InboundMsg;
  if (msg?.type === "init") {
    void handleInit(msg);
  } else if (msg?.type === "call") {
    void handleCall(msg);
  }
});

// Async / fire-and-forget network denials (outside a call's try/catch) must still surface
// visibly rather than crash silently (SDD §1.9: "fail fast and visibly").
function surfaceStray(e: unknown): void {
  if (hasNetDenyCode(e)) {
    send({ type: "fault", kind: "network", detail: describe(e) });
  } else {
    send({ type: "fault", kind: "throw", detail: describe(e) });
  }
}
process.on("uncaughtException", surfaceStray);
process.on("unhandledRejection", surfaceStray);
