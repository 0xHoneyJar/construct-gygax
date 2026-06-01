/**
 * A "repo" with engine code but NO gygax.driver.* file — detectDriver must refuse + spec.
 * (Intentionally not named gygax.driver.ts and exports no gygaxDriver.)
 */
export function resolveClash(): number {
  return 42;
}
