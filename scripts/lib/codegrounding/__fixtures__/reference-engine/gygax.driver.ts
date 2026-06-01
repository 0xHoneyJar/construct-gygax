/**
 * Reference gygaxDriver adapter — a clean, JSON-serializable engine (Sprint 1, Task 1.7).
 *
 * "NimLite": players alternately remove 1–3 tokens from a shared pile; whoever removes the
 * last token wins. Tiny, deterministic, fully JSON-serializable — the canonical example of
 * the contract a real engine's adapter follows (SDD §5.2; grimoires/loa/sprint.md:L91).
 *
 * Detectable via the convention: file named `gygax.driver.ts` at the (fixture) repo root,
 * exporting `gygaxDriver` (driver-detect.ts).
 */
import type { GygaxDriver } from "../../driver-detect.ts";

export interface NimState {
  pile: number;
  toMove: "a" | "b";
}
export interface NimAction {
  take: number;
}

const STARTING_PILE = 5;

export const gygaxDriver: GygaxDriver<NimState, NimAction> = {
  getInitialState(): NimState {
    return { pile: STARTING_PILE, toMove: "a" };
  },

  legalActions(state: NimState): NimAction[] {
    const max = Math.min(3, state.pile);
    const actions: NimAction[] = [];
    for (let n = 1; n <= max; n++) actions.push({ take: n });
    return actions;
  },

  applyAction(state: NimState, action: NimAction): NimState {
    const take = Math.max(1, Math.min(3, action.take));
    return {
      pile: Math.max(0, state.pile - take),
      toMove: state.toMove === "a" ? "b" : "a",
    };
  },

  isTerminal(state: NimState): boolean {
    return state.pile === 0;
  },

  outcome(state: NimState): unknown {
    if (state.pile !== 0) return null;
    // The player who emptied the pile is the one who moved last = NOT the current toMove.
    return { winner: state.toMove === "a" ? "b" : "a" };
  },
};
