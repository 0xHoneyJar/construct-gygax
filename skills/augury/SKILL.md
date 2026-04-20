---
name: augury
description: Analyze balance of TTRPG mechanics through quantitative numerical methods
model_tier: opus
effort: medium
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash
---

# Augury

Quantitative balance analysis for TTRPG mechanics. Augury reads the game-state and produces concrete numbers -- DPR curves, hit probabilities, time-to-kill, action economy budgets, healing throughput, save DC scaling, resource depletion rates, pacing metrics -- then reports findings with specific values, tables, and identified pressure points.

Augury exists because "seems balanced" is not analysis. Every finding must be backed by a calculation. Every recommendation must cite the numbers that motivate it. If the math says a mechanic is fine, Augury says it is fine even if it "feels" off. If the math says a mechanic is broken, Augury says it is broken even if it "feels" okay. The numbers are the argument.

Augury is strictly read-only. It never modifies game-state. It observes, measures, computes, and reports. To act on Augury's findings, use `/homebrew` (to redesign) or `/cabal` (to stress-test in simulated play).

## Trigger

`/augury` with optional scope argument.

Examples:
- `/augury` -- full-spectrum analysis of everything in game-state
- `/augury combat` -- combat-focused analysis (DPR, TTK, action economy)
- `/augury resources` -- resource economy analysis (depletion rates, recovery, pressure)
- `/augury pacing` -- narrative pacing and arc coverage analysis
- `/augury scaling` -- level/tier progression scaling curves
- `/augury mechanics/dodge-reaction.yaml` -- targeted analysis of a specific entity
- `/augury entities/fighter-class.yaml vs entities/wizard-class.yaml` -- comparative analysis

## Analytical Layers (v3.1)

Augury's analysis is organized into 6 declared layers. Each layer has clear boundaries: what entities it needs, what it can detect, what scripts it uses, and which design parameters affect its thresholds.

### Layer: resolution
- **Scope:** Core dice mechanics, probability distributions, outcome spreads
- **Required entities:** mechanics (with `resolution` field)
- **Optional entities:** stats (for modifier analysis)
- **Detects:** false choices (two+ options resolve identically), dead zones (probability ranges with no meaningful outcome), threshold clustering (multiple DCs within 1-2 points), variance mismatch (outcome spread inconsistent with `design_parameters.target_variance`)
- **Scripts:** dice-probability.ts, bell-curve.ts, dice-pool.ts, advantage.ts, exploding-dice.ts
- **Design parameter sensitivity:** `target_variance` — high variance suppresses dead-zone and threshold-clustering warnings

### Layer: action-economy
- **Scope:** Turn structure, action costs, opportunity costs, timing, combat/encounter dynamics
- **Required entities:** mechanics (with `trigger` and `cost` fields)
- **Optional entities:** entities (with stat blocks for encounter analysis)
- **Detects:** proactive/reactive asymmetry, action inflation (too many options per slot), dead turns (slots with no meaningful option), action-cost imbalance (one option strictly better than all alternatives in same slot)
- **Scripts:** none (structural analysis)
- **Design parameter sensitivity:** `target_session_length` — shorter sessions tolerate less dead time

### Layer: resource-economy
- **Scope:** Source/sink balance, recovery rates, depletion curves, cross-resource contention
- **Required entities:** resources (with `pool` and `recovery`)
- **Optional entities:** mechanics (that consume resources via `cost`)
- **Detects:** economic collapse (source > sink), infinite accumulation (negative net pressure), resource irrelevance (never under pressure), hoarding incentives (recovery outpaces spending), recovery-depletion mismatch, **market/trade analysis (v4):** price stability, supply/demand feedback loops, trade fairness between informed/uninformed players
- **Scripts:** dice-probability.ts (for probabilistic recovery)
- **Design parameter sensitivity:** `target_lethality` — brutal games expect faster depletion curves. `target_interaction` — cooperative games share economies (flag individual hoarding), direct-conflict games expect economic warfare

### Layer: progression
- **Scope:** Scaling curves, power budgets, feature distribution across levels/advances
- **Required entities:** progression (with `progression_table`)
- **Optional entities:** mechanics, resources (with `max_by_level`), entities (for class/archetype comparison)
- **Detects:** scaling failure (linear vs exponential divergence), dead levels (no meaningful improvement), power spikes (dramatic single-feature jumps), MAD dependency (stat budget insufficient for core function), design traps (options that appear viable but aren't), **win condition analysis (v4):** victory path balance, path lockout detection, endgame trigger timing
- **Scripts:** cdf-compare.ts (for cross-level comparison)
- **Design parameter sensitivity:** `target_audience` — mastery audience tolerates more trap options; newcomer audience does not. `target_interaction` — solo games skip victory path comparison

### Layer: pacing
- **Scope:** Session arc, encounter density, downtime distribution, mechanic trigger frequency, tension engagement
- **Required entities:** mechanics (with `trigger`), resources (with recovery timing)
- **Optional entities:** tensions, progression (for session arc analysis)
- **Detects:** pacing slogs (extended sequences with no meaningful change), spike-and-recover patterns (sharp intensity swings), trigger starvation (mechanics that never activate), session length mismatch (mechanics too slow/fast for target session), **replayability analysis (v4):** content exhaustion rate, decision-space novelty across replays, emergent variety from systemic interactions
- **Scripts:** none (structural + resource depletion rate analysis)
- **Design parameter sensitivity:** `target_session_length`, `target_prep`, `target_randomness` (none = replayability depends entirely on decision space, not procedural variation)

### Layer: cognitive-load
- **Scope:** Entity count, rule interaction density, decision complexity, communication clarity
- **Required entities:** any (counts and measures complexity across all entity types)
- **Detects:** option paralysis (too many viable choices with unclear value), hidden complexity (interactions not surfaced in entity descriptions), communication failures (mechanics whose effects aren't obvious to players), entity density exceeding cognitive thresholds, simultaneous state tracking burden, **information model problems (v4):** hidden state count, deducibility analysis, information advantage fairness
- **Scripts:** none (counting and structural analysis)
- **Design parameter sensitivity:** `target_audience` (newcomer = lower thresholds), `target_player_count` (larger groups amplify cognitive load), `target_randomness` (none = expect perfect information, flag hidden state as mismatch)

### Structural Analysis (tradition: freeform, custom)

For games where combat math and resource economy don't apply — journaling RPGs, map-drawing games, lyric games, GMless games — the resolution, action-economy, resource-economy, and progression layers may not have applicable entities. In this case, augury runs the pacing and cognitive-load layers plus a **structural analysis pass** covering: decision space, information flow, player agency, loop completeness, and emotional arc. See Step 3d-ext below for details.

## Workflow

### Step 1: Load Game-State and Determine Analysis Scope

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If it does not, stop and tell the user: "No game attuned yet. Run `/attune` first to build your game-state."
2. Read `index.yaml` to get the full entity manifest: game name, tradition, entity counts, file list, graph integrity, and **design parameters**.
3. Determine the analysis scope from the user's invocation:
   - **No argument**: run all layers where required entities exist.
   - **`--layer X`**: run only layer X. `--layer X,Y`: run layers X and Y.
   - **Keyword** (`combat`, `resources`, `pacing`, `scaling`): map to layers — `combat` → resolution + action-economy, `resources` → resource-economy, `pacing` → pacing, `scaling` → progression. (Backwards-compatible aliases.)
   - **Specific entity path**: walk dependency graph 2 hops from target entity, run all layers on the resulting entity set.
   - **Comparative** (`X vs Y`): side-by-side quantitative comparison of two entities.
4. Load entity files relevant to the scope. For full-spectrum, load everything. For entity-targeted or layer-scoped analysis, use the dependency graph to pull in only what matters. For stub entities, note `[STUB — analysis limited]`.
5. Identify the game's tradition. The tradition determines which analysis methodologies apply.
6. Read `design_parameters` from `index.yaml`. For missing fields, resolve tradition-appropriate defaults (see the defaults table in attune Phase 5).

### Step 2: Identify Applicable Layers

For each of the 6 layers, check whether the loaded game-state contains the layer's required entity types. A layer runs only if its required entities exist.

Report at the top of the analysis:
```
Layers run: resolution, resource-economy, pacing, cognitive-load
Layers skipped: action-economy (no mechanics with cost fields), progression (no progression entities)
```

If the user requested a specific layer via `--layer` but the required entities don't exist, explain what is missing rather than silently skipping.

### Step 3: Run Calculations

Execute every applicable analysis type. All calculations must produce specific numerical values. Do not approximate when exact computation is possible.

#### 3a: Combat Analysis

For each entity with attack actions, compute:

**Hit Probability:**
- For d20 systems: `hit_probability = (21 - (target_AC - attack_bonus)) / 20`, clamped to [0.05, 0.95] for natural 1/20 rules.
- For PbtA systems: probability of 10+ (strong hit), 7-9 (weak hit), 6- (miss) on 2d6+stat. Enumerate all dice outcomes.
- For FitD systems: probability distribution for dice pools of size 0-6 (best of Nd6, thresholds at 1-3/4-5/6/crit).
- For custom resolution: derive from the `resolution.method` field in the mechanic schema.

**Damage Per Round (DPR):**
- `DPR = hit_probability * average_damage_per_hit`
- For multiple attacks: `DPR = sum(hit_probability_i * average_damage_i)` for each attack in the action.
- Include conditional damage (e.g., sneak attack, smite) with their trigger probability.
- For nova rounds (action surge, spell slots): compute both sustained DPR and nova DPR separately.

**Time-to-Kill (TTK):**
- `TTK_rounds = target_HP / attacker_DPR`
- Compute for each attacker against relevant targets.

**Action Economy Budget:**
- List every action type in the game's economy (action, bonus action, reaction, movement, free action, or tradition-equivalent).
- For each entity, map what they can do with each action type.
- Identify dead slots (action types with no meaningful option) and contested slots (action types with too many good options competing).

**Save DC Scaling:**
- If the game has save-or-effect mechanics: compute save DC at each available level vs. typical saving throw modifiers.
- `save_failure_probability = (DC - 1 - save_modifier) / 20`, clamped to [0.05, 0.95].
- Flag if failure probability drops below 0.25 (effect becomes unreliable) or exceeds 0.85 (effect becomes unavoidable).

**Healing Throughput:**
- If healing mechanics exist: compute healing per round (in-combat) and healing per rest/downtime cycle (out-of-combat).
- Compare against incoming DPR: `healing_ratio = healing_per_round / expected_incoming_DPR`.
- Flag if ratio exceeds 0.5 (healing may negate attrition) or falls below 0.1 (healing is negligible).

#### 3b: Encounter Analysis

When both PC and monster/NPC stat blocks exist, run encounter-level math:

**Party DPR vs. Monster HP:**
- Sum party DPR across all party members (assume standard party composition if not specified).
- `expected_rounds_to_kill = monster_total_HP / party_DPR`

**Monster DPR vs. Party HP:**
- Sum monster DPR across all monsters in the encounter.
- `expected_rounds_to_down_PC = PC_HP / monster_DPR` (compute per PC).

**Action Economy Ratio:**
- `action_ratio = total_party_actions_per_round / total_monster_actions_per_round`
- Flag if ratio exceeds 2.0 (party dominates) or falls below 0.5 (party is overwhelmed).

**TPK Risk Estimation:**
- Estimate rounds until the party loses its first member: `min(TTK across all PCs by monsters)`.
- Compare against rounds to defeat all monsters: `sum(monster_HP) / party_DPR`.
- If monsters kill PCs faster than the party kills monsters, flag escalating TPK risk.
- Account for healing if present: `effective_PC_HP = PC_HP + (healing_per_round * expected_combat_length)`.

#### 3c: Resource Economy Analysis

For each resource entity:

**Depletion Rate:**
- Identify all mechanics that consume this resource. Sum expected consumption per round (combat) or per session segment (exploration, social).
- `rounds_until_empty = pool_max / consumption_per_round`

**Recovery Rate:**
- From the resource's `recovery` field, compute how much returns and how often.
- `net_pressure = consumption_per_cycle - recovery_per_cycle`
- Positive net_pressure means the resource drains over time. Negative means it accumulates.

**Pressure Points:**
- Identify the moment when a resource hits a critical threshold (e.g., too low to afford any mechanic that uses it).
- `critical_threshold = min(cost among mechanics that use this resource)`
- `rounds_to_critical = (pool_max - critical_threshold) / consumption_per_round`

**Cross-Resource Contention:**
- Identify resources consumed by multiple mechanics.
- Compute the budget: "If the player uses mechanic A twice and mechanic B once, total cost is X out of pool Y."
- Flag when expected usage patterns exhaust the pool in fewer rounds than typical combat length.

#### 3d: Pacing Analysis (Non-Combat and Universal)

This analysis applies to ALL traditions, including games with no combat mechanics.

**Trigger Frequency:**
- For each mechanic, estimate how often its trigger condition arises during play.
- For PbtA moves: based on fictional positioning, estimate triggers per scene.
- For FitD actions: estimate engagement frequency per score/downtime cycle.
- Flag mechanics that trigger too rarely (player forgets they exist) or too frequently (dominates play).

**Narrative Arc Coverage:**
- Map mechanics across narrative phases: setup, rising action, climax, falling action, resolution.
- Identify phases with dense mechanical support vs. phases that are purely freeform.
- Flag if a phase has zero mechanical engagement (players may feel unsupported) or if one phase has disproportionate mechanical weight (play bottlenecks there).

**Resource Tempo:**
- Map resource depletion and recovery against session structure (scenes, acts, sessions).
- Identify where resources create tension (running low) vs. where they are inert (full pool, nothing to spend on).
- Flag "dead zones" where no resource is under pressure and no meaningful resource decision exists.

**Tension Engagement Frequency:**
- For each tension entity, count how many mechanics actively engage both poles.
- Flag tensions where one pole has significantly more mechanical support than the other.
- Flag tensions where the engagement frequency is so low that players may never feel the push-pull.

#### 3d-ext: Structural Analysis (Novel and Minimal Systems)

For games where combat math, resource economy, and traditional pacing don't apply — journaling RPGs, map-drawing games, lyric games, GMless/GMfull-less games, or anything truly experimental — use structural analysis instead. This is also valuable as a supplement for traditional games.

**Decision Space:**
- Count the number of meaningful choices available at each decision point.
- A "meaningful choice" is one where the options lead to detectably different outcomes.
- Flag decision points with only 1 real option (false choice) or with so many options that analysis paralysis is likely.
- For prompt-based games: does each prompt produce genuinely different responses, or do they converge?

**Information Flow:**
- Map what information is public, private, and hidden at each stage of play.
- Flag asymmetries: does one player/role consistently know more than others?
- For journaling RPGs: does the oracle/prompt system provide enough variation to sustain replay?

**Player Agency:**
- Identify where players make decisions vs. where outcomes are determined by the system.
- Flag sections where player agency is very low for extended periods.
- For GMless games: is authority distributed evenly, or does one mechanism concentrate narrative control?

**Loop Completeness:**
- Identify the core loop (the repeating cycle of play).
- Check: does each step in the loop have a clear exit to the next step?
- Flag open loops (steps that don't lead anywhere) and dead ends.
- For seasonal/chapter games: does the macro loop (across sessions) have clear progression?

**Emotional Arc:**
- Map the intended emotional trajectory (tension, release, discovery, loss).
- Check: do mechanics support or undermine the intended emotional beats?
- Flag mechanics that create emotions at odds with the game's stated tone.

#### 3e: Scaling Analysis

If progression data exists, run every applicable analysis at multiple levels/tiers.

1. Identify scaling breakpoints from progression tables (e.g., levels 1, 5, 11, 17 for d20; advances 1-5 for PbtA).
2. Recompute combat metrics (DPR, hit probability, TTK, save DC) at each breakpoint.
3. Recompute resource metrics (pool size, consumption rate, rounds to depletion) at each breakpoint.
4. Produce scaling curves: plot how each metric changes across progression.
5. Flag:
   - **Linear scaling in an exponential system** (or vice versa): one element falls behind or runs away.
   - **Dead levels**: progression points where no meaningful numerical improvement occurs.
   - **Power spikes**: progression points where a single feature causes a dramatic jump.
   - **Crossover points**: levels where one entity overtakes another in a key metric (e.g., fighter DPR exceeds wizard DPR at level X, reverses at level Y).

### Step 4: Compile Findings

Organize all computed results into findings. Every finding must include:

1. **The specific numbers** that support the finding.
2. **The calculation** that produced those numbers (so the user can verify).
3. **A severity classification:**

| Severity | Meaning | Criteria |
|----------|---------|----------|
| **Critical** | A mechanic is mathematically non-functional or degenerate | DPR of 0, TTK of infinity, resource depletes before first use, save DC always fails |
| **Warning** | A mechanic is significantly out of band for its system | DPR 2x+ above/below peers, TTK < 1 round, resource has no pressure, healing negates all damage |
| **Info** | A notable observation that may be intentional | Scaling curve differs from norm, one entity slightly above average, trigger frequency is low |
| **Healthy** | Analysis confirms the mechanic is within expected bounds | Include these so the user knows what IS working, not just what is not |

### Step 4b: Intent-Aware Findings (v3)

Before finalizing severity classifications, check whether the game-state declares designer intent for the affected entities.

1. **Read the `intent` field** from each entity involved in a finding.
2. **If intent exists and the finding conflicts with it:**
   - **Warning → Observation:** If the intent confirms the design is deliberate, downgrade to Observation and tag: "working as designed per intent". The asymmetry or outlier is intentional.
   - **Critical remains Critical:** Math cannot be intentionally broken. A mechanic that produces DPR of 0, infinite TTK, or a resource that depletes before first use is broken regardless of what the designer intended.
   - **Non-obvious findings always surface:** Tag as `[INTENT-ALIGNED]` if the finding matches stated intent, or `[INTENT-CONFLICT]` if it contradicts it. Both cases are worth reporting.
3. **Cite intent in recommendations.** When recommending changes to an entity with declared intent, note it: "Note: this asymmetry is intentional per tensions/instinct-vs-craft.yaml" or similar reference to the specific intent source.

If no intent field exists on an entity, classify findings normally without adjustment.

### Step 4c: Cross-Layer Deduplication (v3.1)

After all layers have produced their findings, run a deduplication pass:

1. Compare findings across layers. If two layers flag the same entity for the same root cause (e.g., resource-economy flags depletion and pacing flags a stall caused by that depletion), keep the finding in the **more specific** layer.
2. In the layer where the finding was removed, add a cross-reference: "See [Layer] [Finding-ID] for this issue."
3. Priority order for specificity: progression > resolution > action-economy > resource-economy > pacing > cognitive-load (more specific layers take precedence).

### Step 4d: Design Parameter Threshold Adjustment (v3.1)

Before finalizing findings, check `design_parameters` from `index.yaml` and adjust thresholds per each layer's declared sensitivity:

- `target_variance: high` → suppress dead-zone and threshold-clustering warnings in resolution layer
- `target_audience: newcomer` → lower cognitive-load thresholds (fewer entities, simpler interactions before flagging)
- `target_audience: mastery` → raise trap-option threshold in progression layer (expert audience expects traps)
- `target_session_length: short` → lower pacing-slog thresholds (less tolerance for slow mechanics)
- `target_lethality: brutal` → raise acceptable depletion rates in resource-economy layer
- `target_player_count: large` → lower cognitive-load thresholds (more simultaneous state tracking)
- `target_interaction: cooperative` → suppress direct-conflict findings (e.g., "player A can block player B" is expected in direct-conflict, a problem in cooperative)
- `target_interaction: solo` → skip player interaction analysis entirely
- `target_randomness: none` → resolution layer skips probability analysis, focuses on decision-space analysis
- `target_randomness: high` → suppress variance warnings (high variance is the design goal)

Document all threshold adjustments in the report's Methodology Notes section: "Design parameter `target_audience: newcomer` lowered cognitive-load threshold from 5 simultaneous states to 3."

If no `design_parameters` are set, use tradition defaults. Document: "No design parameters set. Using [tradition] defaults."

### Step 5: Generate Report

Write the report to `grimoires/gygax/balance-reports/YYYY-MM-DD-scope-description.md`.

The report follows a strict format. Do not deviate.

## Analysis Methodologies

### Combat (d20 and similar)

Core formula chain:

```
hit_probability = clamp((21 - (AC - attack_bonus)) / 20, 0.05, 0.95)
average_damage  = (die_max + 1) / 2 + modifier
DPR             = hit_probability * average_damage * attacks_per_round
TTK             = target_HP / DPR
```

For critical hits (if the system uses them):
```
crit_probability  = crit_range / 20  (e.g., 1/20 for 20-only, 3/20 for 18-20)
crit_extra_damage = extra_dice_average
DPR_with_crits    = (hit_probability - crit_probability) * average_damage
                   + crit_probability * (average_damage + crit_extra_damage)
```

### Combat (PbtA / 2d6+stat)

Probability distribution for 2d6+modifier:

| Outcome | 2d6+0 | 2d6+1 | 2d6+2 | 2d6+3 |
|---------|-------|-------|-------|-------|
| 10+ (strong hit) | 16.7% | 27.8% | 41.7% | 58.3% |
| 7-9 (weak hit)   | 41.7% | 44.4% | 41.7% | 33.3% |
| 6- (miss)         | 41.7% | 27.8% | 16.7% | 8.3% |

Apply these probabilities to move outcomes. "Damage" in PbtA is often fictional, so measure harm-per-move, conditions-applied-per-scene, or similar tradition-appropriate metrics.

### Combat (FitD / Dice Pools)

Probability of best-die outcomes for pools of 0-4d6:

| Pool | Crit (two 6s) | 6 (full) | 4-5 (partial) | 1-3 (fail) |
|------|--------------|----------|----------------|------------|
| 0d (roll 2, take worst) | 0.0% | 2.8% | 41.7% | 55.6% |
| 1d | 0.0% | 16.7% | 33.3% | 50.0% |
| 2d | 2.8% | 27.8% | 44.4% | 25.0% |
| 3d | 7.4% | 34.7% | 44.2% | 13.0% |
| 4d | 13.2% | 38.6% | 39.5% | 8.6% |

Use these to compute expected effect levels and stress expenditure per action.

### Resource Economy

```
consumption_per_round = sum(cost_i * usage_frequency_i) for all mechanics using this resource
rounds_to_empty       = pool_max / consumption_per_round
recovery_per_cycle    = recovery_amount * recovery_opportunities_per_cycle
net_pressure          = consumption_per_cycle - recovery_per_cycle
```

A resource with `net_pressure <= 0` never creates meaningful tension. A resource with `rounds_to_empty < 3` creates panic, not tension.

### Pacing (Non-Combat)

```
trigger_density     = count(mechanics with applicable triggers) per narrative phase
arc_coverage        = phases_with_mechanical_support / total_phases
resource_tension    = phases_where_resource_is_pressured / total_phases
dead_zone_ratio     = phases_with_no_resource_pressure / total_phases
```

Target: `arc_coverage >= 0.6` (mechanics engage at least 3 of 5 narrative phases). `dead_zone_ratio <= 0.2` (at most 1 phase with no resource pressure).

### Scaling

```
metric_at_level_N      = recalculate(base_metric, progression_table[N])
growth_rate            = (metric_at_max - metric_at_min) / (max_level - min_level)
relative_growth        = metric_at_level_N / metric_at_level_1
peer_variance_at_N     = stddev(metric across all comparable entities at level N)
```

Flag when `peer_variance_at_N > 0.5 * mean(metric at level N)` -- one entity is dramatically out of band relative to its peers at that level.

### Script-Backed Math (v3)

Certain probability calculations are unreliable when performed by AI reasoning alone. Bell curves, dice pools, advantage/disadvantage distributions, and exploding dice involve combinatorics and recursive math where LLMs consistently produce incorrect CDFs, wrong expected values, and flawed tail probabilities. Scripts exist to handle these cases with deterministic precision.

**When to invoke scripts vs. use AI reasoning:**

```
IF single die (d20, d100) with static target:
  → AI reasoning sufficient for simple probability
  → Invoke dice-probability.ts only for large-scale tables

ELIF multi-die summation (2d6, 3d6, 4d6 drop lowest):
  → MUST invoke bell-curve.ts
  → AI reasoning produces wrong CDFs

ELIF dice pool (Nd6 count successes):
  → MUST invoke dice-pool.ts
  → Binomial math is LLM-unreliable

ELIF advantage/disadvantage mechanic:
  → MUST invoke advantage.ts
  → Bell-shaped utility curve is counterintuitive

ELIF exploding/acing dice:
  → MUST invoke exploding-dice.ts
  → Target Number Paradox breaks intuition

ELIF cross-system comparison requested:
  → MUST invoke cdf-compare.ts on the two CDFs

# Non-dice resolution methods (v4):

ELIF method in [auction, negotiation]:
  → Structural analysis: valuation range, information advantage, overbid penalty
  → Tag findings: [qualitative — no probability data]

ELIF method == "simultaneous-choice":
  → Payoff matrix analysis if options are enumerable
  → Dominant strategy detection (is one choice always best?)

ELIF method in [worker-placement, drafting, area-majority, card-play, pattern-matching]:
  → Structural analysis: slot/option viability, contention, scoring curves
  → No scripts needed

ELIF method in [deterministic, automated]:
  → Input optimization analysis: decision space size, sensitivity to inputs
  → For automated: focus on draft/positioning inputs, not combat output

ELIF method == "real-time":
  → Qualitative: skill ceiling, APM requirements, accessibility
  → Tag: [qualitative]

ELIF method == "deduction":
  → Information sufficiency, solvability, red herring density
  → Tag: [qualitative]
```

**Invocation pattern:**

All scripts follow the same protocol:

```bash
echo '<json-input>' | npx tsx scripts/lib/{script-name}.ts
```

Example:
```bash
echo '{"dice": 3, "sides": 6, "target": 12}' | npx tsx scripts/lib/bell-curve.ts
# {"probability_at_least": 0.7407, "cdf": [...], "expected_value": 10.5, "stdev": 2.958}
```

**Available scripts** (see `scripts/MANIFEST.yaml` for full details):

| Script | Input Domain | When Required |
|--------|-------------|---------------|
| `dice-probability.ts` | Single-die distributions (d4-d100) | Large-scale probability tables |
| `bell-curve.ts` | Multi-die summation (2d6, 3d6, Traveller/Cepheus) | Any multi-die sum calculation |
| `dice-pool.ts` | Success-counting pools (Shadowrun, Storyteller, FitD) | Any dice pool probability |
| `advantage.ts` | Advantage/disadvantage (5e-style) | Any advantage/disadvantage analysis |
| `exploding-dice.ts` | Recursive aces (Savage Worlds, DCC, Feng Shui) | Any exploding die calculation |
| `cdf-compare.ts` | Two CDF distributions across DC range | Any cross-system comparison |

**Citation requirement:** Script outputs must be cited in reports with their input parameters. Example: "Source: bell-curve.ts, input: {dice:3, sides:6, target:12}, output: probability_at_least=0.7407"

### Cross-System Comparison (v3)

Augury can compare the current game-state against installed reference game-states to produce quantitative cross-system analysis. Reference systems are installed via `/attune --reference {name}` and stored in `grimoires/gygax/references/{name}/`.

**Invocation patterns:**

- `/augury compare` -- auto-suggest available comparisons based on installed references
- `/augury compare --against 5e-srd` -- full-spectrum comparison vs reference
- `/augury compare dodge-reaction vs 5e-srd:shield-spell` -- entity-level comparison
- `/augury compare DOSE vs 5e-srd:ability-score-cap` -- cross-concept comparison

**Comparison process:**

1. **Parse invocation:** Identify source (current game-state entity or scope) and target (reference system entity or scope).
2. **Load game-states:** Load source from `grimoires/gygax/game-state/` and target from `grimoires/gygax/references/{name}/game-state/`.
3. **Resolve entities:** Match by ID, name, or auto-select the most similar entity if no exact match exists.
4. **Extract and compute:** For each pair, extract core numerical properties (range, costs, probabilities). If dice math applies, invoke `cdf-compare.ts` to produce precise probability deltas.
5. **Build delta table + narrative:** Produce a table showing what is the same, what differs, and by how much. Generate narrative explaining what the deltas mean for the design.
6. **Write report:** Output to `grimoires/gygax/balance-reports/comparison-YYYY-MM-DD-description.md`.

## Report Format

```markdown
# Balance Report: [Scope Description]

**Date:** YYYY-MM-DD
**Game:** [game name from index.yaml]
**Tradition:** [tradition]
**Scope:** [full-spectrum | layer: X | targeted: entity-id | comparative: A vs B]
**Layers Run:** [list of layers that ran]
**Layers Skipped:** [list with reasons]
**Design Parameters:** [list active parameters, note which are explicit vs tradition defaults]
**Entities Analyzed:** [count]

## Executive Summary

[3-5 sentences: what was analyzed, how many findings at each severity, and the single most important takeaway.]

## Resolution Analysis

### Hit Probability

| Entity | Attack Bonus | Target AC | Hit Probability |
|--------|-------------|-----------|-----------------|
| ...    | ...         | ...       | ...             |

### Damage Per Round

| Entity | Attacks | Avg Damage/Hit | Hit Prob | DPR (Sustained) | DPR (Nova) |
|--------|---------|----------------|----------|-----------------|------------|
| ...    | ...     | ...            | ...      | ...             | ...        |

### Time-to-Kill Matrix

| Attacker → Target ↓ | Entity A | Entity B | ... |
|----------------------|----------|----------|-----|
| Entity A             | —        | N rounds | ... |
| Entity B             | N rounds | —        | ... |

### Action Economy

| Entity | Action | Bonus Action | Reaction | Dead Slots | Contested Slots |
|--------|--------|-------------|----------|------------|-----------------|
| ...    | ...    | ...         | ...      | ...        | ...             |

[Include only sections for which data exists. Omit sections with no applicable data.]

## Action Economy Analysis

[Action types, dead slots, contested slots, proactive/reactive mapping. Include only if action-economy layer ran.]

## Resource Economy Analysis

### Depletion Rates

| Resource | Pool Max | Consumers | Consumption/Round | Rounds to Empty |
|----------|---------|-----------|-------------------|-----------------|
| ...      | ...     | ...       | ...               | ...             |

### Recovery Rates

| Resource | Recovery Trigger | Amount | Net Pressure/Cycle |
|----------|-----------------|--------|--------------------|
| ...      | ...             | ...    | ...                |

### Pressure Points

| Resource | Critical Threshold | Rounds to Critical | Consequence |
|----------|-------------------|--------------------|-------------|
| ...      | ...               | ...                | ...         |

## Progression Analysis

[Scaling curves, dead levels, power spikes, crossover points. Include only if progression layer ran.]

## Pacing Analysis

### Trigger Frequency

| Mechanic | Trigger Condition | Est. Frequency | Phase Coverage |
|----------|------------------|----------------|----------------|
| ...      | ...              | ...            | ...            |

### Narrative Arc Coverage

| Phase | Mechanics Engaged | Resource Pressure | Assessment |
|-------|------------------|-------------------|------------|
| Setup | ...              | ...               | ...        |
| Rising Action | ...       | ...               | ...        |
| Climax | ...             | ...               | ...        |
| Falling Action | ...      | ...               | ...        |
| Resolution | ...          | ...               | ...        |

## Cognitive Load Analysis

[Entity counts, rule interaction density, decision complexity, communication clarity. Include only if cognitive-load layer ran.]

## Findings

| # | Layer | Severity | Finding | Values |
|---|-------|----------|---------|--------|
| R-1 | Resolution | Healthy | [description] | [specific numbers] |
| AE-1 | Action Economy | Warning | [description] | [specific numbers] |
| RE-1 | Resource Economy | Critical | [description] | [specific numbers] |
| P-1 | Pacing | Info | [description] | [specific numbers] |

[Finding IDs are prefixed by layer: R=resolution, AE=action-economy, RE=resource-economy, PR=progression, PA=pacing, CL=cognitive-load. Cross-layer references: "See RE-3 for the underlying cause."]

## Recommendations

[Numbered list. Each recommendation cites the finding number it addresses and proposes a specific numerical change, not a vague direction. Example: "Finding #2: Increase stamina pool from 10 to 14, which changes rounds-to-empty from 2.5 to 3.5, bringing dodge usage in line with expected combat length of 3-4 rounds."]

## Methodology Notes

[Any assumptions made, data gaps encountered, or caveats about the analysis. Transparency about what the numbers do and do not capture.]

## Recommended Next Steps

[For each finding, suggest a specific next-skill invocation:]
- Critical/Warning findings: "`/homebrew {entity path}` — suggested change: {specific numerical adjustment to address finding #N}"
- Info findings: "`/cabal --optimizer {entity path}` to test whether this matters in practice"
- For pattern-related findings: "`/lore {scope}` to check against known tradition anti-patterns"
- For design branch exploration: "`/scry "{proposed change}"` to test the impact before committing"

[Each recommendation must include the exact invocation command, not just the skill name.]
```

## Boundaries

- Does NOT modify game-state files -- read-only analysis (use `/homebrew` to act on findings)
- Does NOT design new mechanics or propose creative solutions (use `/homebrew` for that)
- Does NOT ingest source material (use `/attune` for that)
- Does NOT simulate full play sessions or adversarial interaction (use `/cabal` for that)
- Does NOT apply qualitative heuristic pattern-matching (use `/lore` for that)
- Does NOT produce vibes-based assessments -- every claim requires a number
- DOES analyze any mechanic type: combat, social, exploration, downtime, crafting, faction play
- DOES adapt methodology to tradition -- will not force d20 combat math onto a PbtA game
- DOES report "Healthy" findings so the user knows what is working, not only what is broken
- DOES handle games with no combat by analyzing pacing, resource economy, and narrative arc coverage
- DOES invoke probability scripts for math the AI runtime cannot reliably compute
- DOES cross-reference against installed reference game-states for comparison
- Does NOT edit files in `.claude/` (System Zone)

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Balance report | `grimoires/gygax/balance-reports/YYYY-MM-DD-scope-description.md` | Markdown with tables |
| Comparison report | `grimoires/gygax/balance-reports/comparison-YYYY-MM-DD-description.md` | Markdown with tables |

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Direct to `/attune` |
| Requested scope has no applicable data | "The game-state has no [combat mechanics / resource entities / progression data]. I can analyze [what does exist] instead." | Offer alternative scope |
| Incomplete entity data (e.g., attack with no damage listed) | Note the gap in the report's Methodology Notes section. Compute what is possible, mark missing values as "N/A (data missing: [field])". | Partial analysis with explicit gaps |
| Progression table has gaps (some levels defined, others not) | Interpolate linearly between known points. Note the interpolation in Methodology Notes. | Interpolated scaling |
| Tradition has no standard benchmarks (custom system) | Analyze internal consistency only (entities relative to each other). Do not compare against external baselines. | Relative analysis |
| User requests comparison but only one entity exists | "I can only find [entity A]. To compare, I need a second entity in game-state. Run `/attune` to add it, or specify a different entity." | Ask for clarification |
| Missing reference system | "No reference '{name}' installed. Use `/attune --reference {name}` to install. Available references: [list]." | Direct to `/attune --reference` |
| Script execution failure | "Probability script failed: [error]. Falling back to AI estimation (lower confidence)." | Degrade gracefully with reduced confidence |
