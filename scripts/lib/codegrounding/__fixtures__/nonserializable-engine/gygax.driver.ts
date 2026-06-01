/**
 * Fault fixture: getInitialState() returns a non-JSON-serializable value (BigInt).
 * Exercises the hard NON_SERIALIZABLE error instructing the adapter author (SDD §6.1).
 */
import type { GygaxDriver } from "../../driver-detect.ts";

export const gygaxDriver: GygaxDriver<unknown, unknown> = {
  getInitialState(): unknown {
    // BigInt is not JSON-serializable — JSON.stringify throws.
    return { pile: 5n };
  },
  legalActions(): unknown[] {
    return [];
  },
  applyAction(s: unknown): unknown {
    return s;
  },
  isTerminal(): boolean {
    return false;
  },
  outcome(): unknown {
    return null;
  },
};
