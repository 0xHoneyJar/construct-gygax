/**
 * Real-code patterns the synthetic fixture lacked (cycle-006 F1 hardening, modeled on carmack-engine):
 *   - a DEFAULT_ config OBJECT (nested numeric params) — engine-default via direct-property propagation
 *   - depth-scaling FORMULAS (non-literal initializers) — the tuning surface, captured as FormulaFacts
 *   - the max(1, ...) damage floor — a structural invariant inside a sim function
 *   - a bulk sample-data object with deeply-nested coords — must NOT be over-tagged
 */

// engine-default config object: direct numeric properties should be tagged.
export const DEFAULT_PLAYER = { maxHP: 100, attack: 5, defense: 1 };

// Bulk sample data: nested coordinates must NOT inherit engine-default.
export const DEFAULT_DEMO_LEVEL = {
  width: 12,
  rooms: [{ x: 1, y: 2 }, { x: 7, y: 9 }],
};

// Depth-scaling formulas — previously invisible to F1 (non-literal initializers).
export function generateEncounter(depth: number) {
  const enemyDEF = depth <= 9 ? 0 : Math.floor((depth - 9) / 4);
  const enemyHP = 10 + Math.floor((depth - 9) * 1.5);
  const bruteHP = Math.floor(enemyHP * 1.5);
  return { enemyDEF, enemyHP, bruteHP };
}

// The structural min-1 damage floor, inside a combat/sim function.
export function resolveDamage(attack: number, defense: number): number {
  return Math.max(1, attack - defense);
}
