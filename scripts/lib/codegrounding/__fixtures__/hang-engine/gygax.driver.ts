/**
 * Fault fixture: getInitialState() never returns (tight infinite loop).
 * Exercises the wall-clock cap → fault{timeout} (SDD §6.1).
 */
import type { GygaxDriver } from "../../driver-detect.ts";

export const gygaxDriver: GygaxDriver<unknown, unknown> = {
  getInitialState(): unknown {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      /* spin — blocks until the parent's wall-clock cap kills the child */
    }
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
