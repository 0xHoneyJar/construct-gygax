/**
 * sandbox.ts — the PARENT side of the execution sandbox
 *
 * Sprint 1, Tasks 1.4 / 1.5 (grimoires/loa/sprint.md:L88-89; SDD §1.4, §1.9, §5.3, §6.1).
 *
 * Spawns runner.ts as a forked `child_process`, drives the engine through the gygaxDriver
 * contract over JSON IPC, and enforces the two caps that bound the MUNDANE failure modes
 * (prd.md:L240-241): runaway loops (wall-clock) and runaway memory (RSS watchdog +
 * --max-old-space-size). Network is denied in-process by the child (net-deny.ts).
 *
 * The child_process boundary is a BLAST-RADIUS limiter, not a trust boundary against hostile
 * code (SDD §1.9). Docker/container isolation was explicitly dropped (prd.md:L247-248).
 */
import { fork, execFile, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH = join(HERE, "runner.ts");

export interface SandboxCaps {
  /** Wall-clock cap per call, in milliseconds. Overrun → fault{timeout}. */
  wallMs: number;
  /** Memory cap, in MB. Overrun → fault{oom} (RSS watchdog + V8 hard heap cap). */
  memMB: number;
}

export interface SandboxOptions {
  /** Working directory; the child's cwd and FS scope (SDD §1.9). */
  repoPath: string;
  /** Absolute path to the adapter module exporting `gygaxDriver`. */
  driverModule: string;
  caps: SandboxCaps;
  /** Network policy; defaults to "deny" (prd.md:L243-244). */
  network?: "deny" | "allow";
}

export type FaultKind = "timeout" | "oom" | "network" | "throw";

/** An operational fault from running engine code in the sandbox (SDD §5.3). */
export class SandboxFault extends Error {
  kind: FaultKind;
  detail: string;
  constructor(kind: FaultKind, detail: string) {
    super(`sandbox fault[${kind}]: ${detail}`);
    this.name = "SandboxFault";
    this.kind = kind;
    this.detail = detail;
  }
}

/** A hard error about the adapter/setup itself (driver absent/invalid, non-serializable). */
export class SandboxError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SandboxError";
    this.code = code;
  }
}

/** How frequently the parent samples child RSS for the memory watchdog. */
const RSS_POLL_MS = 50;

/** Read a process's RSS in MB via `ps`, or null if unavailable (e.g. already exited). */
function readRssMB(pid: number): Promise<number | null> {
  return new Promise((res) => {
    execFile("ps", ["-o", "rss=", "-p", String(pid)], (err, stdout) => {
      if (err) return res(null);
      const kb = parseInt(stdout.trim(), 10);
      res(Number.isFinite(kb) ? kb / 1024 : null);
    });
  });
}

const OOM_STDERR = /out of memory|heap limit|Allocation failed|JavaScript heap/i;

export class Sandbox {
  private child: ChildProcess;
  private caps: SandboxCaps;
  private getStderr: () => string;
  private busy = false;
  private closed = false;

  private constructor(child: ChildProcess, caps: SandboxCaps, getStderr: () => string) {
    this.child = child;
    this.caps = caps;
    this.getStderr = getStderr;
  }

  /**
   * Spawn the child, send `init`, and resolve once it reports `ready`.
   * Rejects with SandboxError if the driver is absent/invalid or the child dies first.
   */
  static start(opts: SandboxOptions): Promise<Sandbox> {
    return new Promise((resolveP, rejectP) => {
      const child = fork(RUNNER_PATH, [], {
        cwd: opts.repoPath,
        // No --import tsx: the child runs plain `node` native type-stripping (runner.ts and
        // its imports use .ts extensions). --max-old-space-size is the V8 hard heap cap.
        execArgv: [`--max-old-space-size=${opts.caps.memMB}`],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
        env: { ...process.env },
      });

      let stderr = "";
      child.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      const getStderr = () => stderr;

      const onMessage = (msg: { type?: string; code?: string; message?: string }) => {
        if (msg?.type === "ready") {
          cleanup();
          resolveP(new Sandbox(child, opts.caps, getStderr));
        } else if (msg?.type === "error") {
          cleanup();
          child.kill("SIGKILL");
          rejectP(new SandboxError(msg.code ?? "DRIVER_ERROR", msg.message ?? "driver error"));
        }
      };
      const onExit = (code: number | null, signal: string | null) => {
        cleanup();
        rejectP(
          new SandboxError(
            "CHILD_EXIT_BEFORE_READY",
            `child exited before ready (code=${code}, signal=${signal})\n${stderr}`,
          ),
        );
      };
      const cleanup = () => {
        child.off("message", onMessage);
        child.off("exit", onExit);
      };

      child.on("message", onMessage);
      child.on("exit", onExit);
      child.send({
        type: "init",
        repoPath: opts.repoPath,
        driverModule: opts.driverModule,
        network: opts.network ?? "deny",
      });
    });
  }

  /**
   * Invoke a driver function in the child and await its result.
   * @throws SandboxFault on timeout/oom/network/throw; SandboxError on adapter/setup errors.
   */
  call(fn: string, ...args: unknown[]): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new SandboxError("SANDBOX_CLOSED", "sandbox already closed"));
    }
    if (this.busy) {
      return Promise.reject(
        new SandboxError("SANDBOX_BUSY", "a call is already in flight (one at a time)"),
      );
    }
    this.busy = true;
    const child = this.child;

    return new Promise((resolveP, rejectP) => {
      // killReason records WHY the parent killed the child, so onExit can classify the fault.
      let killReason: FaultKind | null = null;

      const wall = setTimeout(() => {
        killReason = "timeout";
        child.kill("SIGKILL");
      }, this.caps.wallMs);

      const poll = setInterval(() => {
        if (child.pid == null) return;
        void readRssMB(child.pid).then((mb) => {
          if (mb !== null && mb > this.caps.memMB && killReason === null) {
            killReason = "oom";
            child.kill("SIGKILL");
          }
        });
      }, RSS_POLL_MS);

      const finish = () => {
        clearTimeout(wall);
        clearInterval(poll);
        child.off("message", onMessage);
        child.off("exit", onExit);
        this.busy = false;
      };

      const onMessage = (msg: {
        type?: string;
        value?: unknown;
        kind?: FaultKind;
        detail?: string;
        code?: string;
        message?: string;
      }) => {
        if (msg?.type === "result") {
          finish();
          resolveP(msg.value);
        } else if (msg?.type === "fault") {
          finish();
          rejectP(new SandboxFault(msg.kind ?? "throw", msg.detail ?? ""));
        } else if (msg?.type === "error") {
          finish();
          rejectP(new SandboxError(msg.code ?? "ERROR", msg.message ?? "error"));
        }
      };

      const onExit = (code: number | null) => {
        finish();
        this.closed = true;
        if (killReason === "timeout") {
          rejectP(new SandboxFault("timeout", `wall-clock cap ${this.caps.wallMs}ms exceeded`));
        } else if (killReason === "oom") {
          rejectP(new SandboxFault("oom", `memory cap ${this.caps.memMB}MB exceeded (RSS watchdog)`));
        } else if (OOM_STDERR.test(this.getStderr())) {
          // V8 hit its own --max-old-space-size cap and aborted before we sampled RSS.
          rejectP(new SandboxFault("oom", `child V8 heap OOM (cap ${this.caps.memMB}MB)`));
        } else {
          rejectP(new SandboxFault("throw", `child exited unexpectedly (code=${code})`));
        }
      };

      child.on("message", onMessage);
      child.on("exit", onExit);
      child.send({ type: "call", fn, args });
    });
  }

  /** Kill the child and mark the sandbox closed. Idempotent. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.child.kill("SIGKILL");
  }
}
