/**
 * Fixture engine for F1 analyzer/reconciler tests.
 * Contains: one CERTAIN call edge, two UNTRACEABLE sites, and numeric literals.
 */
export const FIRE_BASE_DAMAGE = 12;

export function resolveClash(state: Record<string, number>): number {
  const dmg = FIRE_BASE_DAMAGE;
  // CERTAIN edge: resolveClash -> applyCondition (direct call to a named engine fn)
  applyCondition(state);
  return dmg;
}

export function applyCondition(state: Record<string, number>): Record<string, number> {
  state.conditioned = 1;
  return state;
}

export function tickReactive(store: { subscribe: (f: () => void) => void }): void {
  // UNTRACEABLE: reactive store subscription — must NOT be asserted as a loop
  store.subscribe(() => {});
}

const handlers: Record<string, (s: unknown) => void> = {};
export function dispatchDynamic(name: string, state: unknown): void {
  // UNTRACEABLE: dynamic dispatch via computed member — must NOT be asserted
  handlers[name](state);
}
