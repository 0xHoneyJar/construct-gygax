/**
 * net-deny.ts — in-process network egress denial for the sandbox child
 *
 * Sprint 1, Task 1.6 (grimoires/loa/sprint.md:L90; SDD §1.9, §5.3; OQ-2).
 *
 * Threat model is MUNDANE (prd.md:L240-241): a stray web3/RPC call from the engine's own
 * code, not malice. The goal is "fail fast and visibly," not airtight isolation. So we deny
 * the realistic egress vectors (fetch/undici, http(s), raw sockets, dns, tls) by patching
 * them to throw a tagged error. runner.ts maps that tag to fault{kind:"network"}.
 *
 * OQ-2 resolution: in-process patching (installed before the adapter is imported) rather than
 * a `--import` preload, so the deny is active without depending on flag/loader ordering.
 * Loads under plain `node` native type-stripping in the child — only `node:` builtins, no
 * enums/namespaces.
 */
import net from "node:net";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import tls from "node:tls";

/** Tag carried by every denial so runner.ts can classify it as a network fault. */
export const NET_DENY_CODE = "GYGAX_NET_DENY";

export class NetworkDeniedError extends Error {
  code: string;
  constructor(target: string) {
    super(`network egress denied by sandbox (network: "deny"): ${target}`);
    this.name = "NetworkDeniedError";
    this.code = NET_DENY_CODE;
  }
}

let installed = false;

/**
 * Patch the common egress points to throw `NetworkDeniedError`. Idempotent.
 * Call this BEFORE importing the adapter so module-load side effects are covered too.
 */
export function installNetworkDeny(): void {
  if (installed) return;
  installed = true;

  const deny = (target: string): never => {
    throw new NetworkDeniedError(target);
  };

  // fetch / undici (global in Node ≥18)
  (globalThis as { fetch?: unknown }).fetch = (input: unknown): never => {
    const url =
      typeof input === "string"
        ? input
        : (input as { url?: string } | null)?.url ?? "<request>";
    return deny(`fetch ${url}`);
  };

  // node:net — raw TCP
  net.connect = (() => deny("net.connect")) as typeof net.connect;
  net.createConnection = (() => deny("net.createConnection")) as typeof net.createConnection;
  const sockConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (this: net.Socket): net.Socket {
    void sockConnect; // intentionally not called — egress denied
    return deny("Socket.connect");
  } as typeof net.Socket.prototype.connect;

  // node:http / node:https — most HTTP clients (axios, node-fetch, viem) funnel through these
  http.request = (() => deny("http.request")) as typeof http.request;
  http.get = (() => deny("http.get")) as typeof http.get;
  https.request = (() => deny("https.request")) as typeof https.request;
  https.get = (() => deny("https.get")) as typeof https.get;

  // node:tls — TLS sockets
  tls.connect = (() => deny("tls.connect")) as typeof tls.connect;

  // node:dns — name resolution (deny early so even lookups fail visibly)
  dns.lookup = ((..._args: unknown[]) => deny("dns.lookup")) as unknown as typeof dns.lookup;
  if (dns.promises) {
    dns.promises.lookup = ((..._args: unknown[]) =>
      deny("dns.promises.lookup")) as unknown as typeof dns.promises.lookup;
  }
}

/** Test/diagnostic helper: has the shim been installed in this process? */
export function isNetworkDenyInstalled(): boolean {
  return installed;
}
