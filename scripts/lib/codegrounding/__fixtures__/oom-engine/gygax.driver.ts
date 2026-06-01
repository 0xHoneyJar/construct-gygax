/**
 * Fault fixture: getInitialState() allocates without bound.
 * Exercises the memory cap → fault{oom} (RSS watchdog / V8 heap cap) (SDD §6.1).
 */
import type { GygaxDriver } from "../../driver-detect.ts";

export const gygaxDriver: GygaxDriver<unknown, unknown> = {
  getInitialState(): unknown {
    const hog: number[][] = [];
    // ~8MB per push; blows past a low memMB cap within a few iterations.
    for (;;) {
      hog.push(new Array(1_000_000).fill(0));
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
