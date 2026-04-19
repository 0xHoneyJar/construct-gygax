# Post-Mortem of Complexity: Systemic Game Design Failures

Reference document for evaluation harness development. Source: PDF analysis of documented design failures across multiple game systems.

## Failure Categories & Case Studies

### 1. Scaling Failures / Design Traps (D&D 3.x)
- **Toughness Feat**: Static +3 HP bonus negligible past level 1. Occupies valuable feat slot. Classic "Ivory Tower Design" — intentional bad option that punishes non-experts.
- **Monk (MAD)**: Requires high STR, DEX, CON, WIS simultaneously. Splitting resources across four stats ensures mediocrity in all. Cool abilities become impossible to land.
- **Mystic Theurge**: Dual-progression delays access to higher-level spells. Always a tier behind. Action economy limits one spell per turn, making deep pool of weak spells useless.
- **CoDzilla (Linear Martial / Exponential Caster)**: Tier 1 classes superior not because of damage but because they are *proactive* (prevention via battlefield control) vs martial classes being *reactive* (damage control after the fact). Prevention is mathematically superior to reaction. Fighter agency deleted when wizard neutralizes all threats.

**Detection pattern**: Compare option scaling curves across levels. Flag static bonuses in systems with multiplicative growth. Flag MAD requirements where stat budget makes core abilities unreachable. Flag proactive/reactive asymmetry in class design.

### 2. Economic Collapse (Ultima Online, CS:Source)
- **Hyperinflation**: NPC shopkeepers "printed" money on demand by purchasing worthless player-crafted items. Currency devalued to irrelevance.
- **Cartel Monopolies**: Player groups cornered magical reagent market, preventing general population from spellcasting.
- **Safety Deposit Paradox**: Vendor stalls used as invulnerable hoarding containers at non-market prices, preventing item circulation.
- **Closed-Loop Failure**: Intended finite ecology emptied by player hoarding, forcing team to abandon original design vision.
- **CS:Source Dynamic Weapon Pricing**: Auto-balancing algorithm based on global demand led to $16,000 Desert Eagle and $1 Glock. Punished popular choices — players switch games, not strategies.

**Detection pattern**: Trace resource generation vs consumption rates. Flag infinite sources without matching sinks. Flag feedback loops where player behavior can corner shared resources. Flag auto-balancing that punishes demand instead of redirecting it.

### 3. Degenerate Metagames (MtG Combo Winter)
- **Tolarian Academy**: Deleted interactive game phases. "Early game is shuffling, midgame is drawing, late game is turn 1."
- **Legend Rule Vulnerability**: First player to drop legendary land locked opponent out of their copy — insurmountable resource lead on turn one.
- **Mulligan Exploitation**: "0 or 7 lands" rule intended as safety net became a weapon. Low land counts (18-20) triggered free mulligans to dig for combo pieces.

**Detection pattern**: Flag mechanics where prevention of interaction is possible. Flag safety-net mechanics that can be weaponized. Flag first-mover advantages that compound into dominance. Flag win conditions achievable before opponent can respond.

### 4. Cognitive Load / Pacing (Fall from Heaven mod, Civ IV)
- **Civilization Density**: 21 civilizations instead of 9-10. Overwhelmed cognitive load, thinned polish per asset.
- **Communication Failures**: Key mechanics lacked documentation. "Pool of Tears" (cured disease) and "Blaze" spell provided no mouse-over help.
- **Pacing Slogs**: 690-turn games. Victory conditions requiring 16 different mana sources turned endgame into repetitive grind.

**Detection pattern**: Flag entity counts that exceed cognitive thresholds for their type. Flag mechanics without clear player-facing communication of effects. Flag victory/completion conditions with excessive prerequisite counts. Flag session length extrapolation against pacing curves.

## Synthesis: Failure Archetypes for Evaluation Harnesses

| Archetype | Core Signal | Gygax Detection Tool |
|-----------|-------------|---------------------|
| Scaling Failure | Static bonus in multiplicative system | `/augury` (scaling scope) |
| Design Trap | Option that appears viable but isn't | `/augury` + `/cabal` (Newcomer vs Optimizer divergence) |
| MAD Dependency | Stat budget insufficient for core function | `/augury` (stat allocation analysis) |
| Proactive/Reactive Asymmetry | One role class can prevent what another can only react to | `/augury` (action economy) + `/lore` |
| Economic Collapse | Source > Sink imbalance | `/augury` (resource economy) |
| Degenerate Strategy | Win condition before interaction possible | `/cabal` (Optimizer archetype) |
| Safety Net Weaponization | Recovery mechanic exploitable as advantage | `/augury` + `/lore` |
| Cognitive Overload | Entity count exceeds processing capacity | `/lore` + `/cabal` (Newcomer + Anxious) |
| Pacing Slog | Session length extrapolation exceeds tolerance | `/augury` (pacing scope) |
| Communication Failure | Mechanic effect not surfaced to player | `/cabal` (Newcomer archetype) |

## Key Principle

> "Systemic failures are rarely isolated bugs; they represent a fundamental misalignment between developer intent and the reality of player optimization."

This directly maps to Gygax's intent-aware analysis: the gap between mechanical_intent and what /augury + /cabal actually detect IS the design failure.
