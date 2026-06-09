/**
 * FR-3 fixture inputs for tunability inference (cycle-005, Sprint A).
 * Three cases: engine-default (DEFAULT_ const), structural (number in a sim-loop fn),
 * and untagged (a plain UI const). All values are code-only (absent from the
 * drift-gamestate fixture) so they produce no numeric drift.
 */

// engine-default: a replaceable sample/config value (DEFAULT_ name signal).
export const DEFAULT_STARTING_GOLD = 50;

// structural: a number hardcoded inside the core simulation loop.
export function simulateStep(depth: number): number {
  const armorCap = 4; // structural — lives in the sim loop, an engine invariant
  return Math.min(armorCap, depth);
}

// untagged: a presentation constant with no tuning signal.
export const panelWidth = 80;
