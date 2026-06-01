/**
 * Fault fixture: getInitialState() attempts a network egress (fetch).
 * Under network:"deny" the shim throws → runner maps it to fault{network} (SDD §1.9, §5.3).
 */
import type { GygaxDriver } from "../../driver-detect.ts";

export const gygaxDriver: GygaxDriver<unknown, unknown> = {
  getInitialState(): unknown {
    // A stray RPC/web3-style call. The deny shim makes this fail fast and visibly.
    void (globalThis as { fetch: (u: string) => unknown }).fetch("http://127.0.0.1:9/blocked");
    return { reached: "network" }; // never returned under deny
  },
  legalActions(): unknown[] {
    return [];
  },
  applyAction(s: unknown): unknown {
    return s;
  },
  isTerminal(): boolean {
    return true;
  },
  outcome(): unknown {
    return null;
  },
};
