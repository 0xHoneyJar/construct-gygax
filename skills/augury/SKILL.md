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

## Workflow

### Step 1: Load Game-State and Determine Analysis Scope

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If it does not, stop and tell the user: "No game attuned yet. Run `/attune` first to build your game-state."
2. Read `index.yaml` to get the full entity manifest: game name, tradition, entity counts, file list, and dependency graph summary.
3. Determine the analysis scope from the user's invocation:
   - **No argument**: full-spectrum analysis across all entity types present in game-state.
   - **Keyword** (`combat`, `resources`, `pacing`, `scaling`): scoped analysis focused on that domain.
   - **Specific entity path**: targeted analysis of one entity and everything it depends on / affects.
   - **Comparative** (`X vs Y`): side-by-side quantitative comparison of two entities.
4. Load all entity files relevant to the scope. For full-spectrum, load everything. For scoped analysis, use the dependency graph to pull in only what matters.
5. Identify the game's tradition. The tradition determines which analysis methodologies apply and which would be nonsensical (do not calculate DPR for a freeform game with no attack rolls).

### Step 2: Identify Analysis Type

Based on the loaded game-state and the scope, determine which analysis types are applicable. A single invocation may produce multiple analysis types.

| Analysis Type | Applicable When | Not Applicable When |
|---------------|----------------|---------------------|
| **Combat** | Game-state contains attack mechanics, damage values, AC/defense, HP | No combat mechanics exist (freeform, some PbtA) |
| **Encounter** | Game-state contains both PC entities and monster/NPC entities with stat blocks | Only one side of the equation exists |
| **Resource Economy** | Game-state contains resources with `pool`, `recovery`, and `depletion_consequence` | No resource entities defined |
| **Pacing** | Game-state contains mechanics with triggers, resources with recovery timing, or progression gates | Nothing to measure tempo against |
| **Scaling** | Game-state contains progression entities with `progression_table` or resources with `max_by_level` | No level-dependent data exists |

Inform the user which analysis types will be run and why. If the user requested a specific type but the game-state lacks the data to support it, explain what is missing.

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

## Report Format

```markdown
# Balance Report: [Scope Description]

**Date:** YYYY-MM-DD
**Game:** [game name from index.yaml]
**Tradition:** [tradition]
**Scope:** [full-spectrum | combat | resources | pacing | scaling | targeted: entity-id | comparative: A vs B]
**Entities Analyzed:** [count]

## Executive Summary

[3-5 sentences: what was analyzed, how many findings at each severity, and the single most important takeaway.]

## Combat Analysis

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

## Resource Economy

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

## Scaling Analysis

### [Metric] by Level

| Level | Entity A | Entity B | ... | Peer Variance |
|-------|----------|----------|-----|---------------|
| 1     | ...      | ...      | ... | ...           |
| 5     | ...      | ...      | ... | ...           |
| 11    | ...      | ...      | ... | ...           |

[Repeat table for each key metric: DPR, HP, Save DC, Resource Pool, etc.]

### Scaling Flags

- **Dead levels:** [list]
- **Power spikes:** [list]
- **Crossover points:** [list]

## Findings

| # | Severity | Category | Finding | Values |
|---|----------|----------|---------|--------|
| 1 | Critical | Combat   | [description] | [specific numbers] |
| 2 | Warning  | Resource | [description] | [specific numbers] |
| 3 | Info     | Scaling  | [description] | [specific numbers] |
| 4 | Healthy  | Combat   | [description] | [specific numbers] |

## Recommendations

[Numbered list. Each recommendation cites the finding number it addresses and proposes a specific numerical change, not a vague direction. Example: "Finding #2: Increase stamina pool from 10 to 14, which changes rounds-to-empty from 2.5 to 3.5, bringing dodge usage in line with expected combat length of 3-4 rounds."]

## Methodology Notes

[Any assumptions made, data gaps encountered, or caveats about the analysis. Transparency about what the numbers do and do not capture.]
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
- Does NOT edit files in `.claude/` (System Zone)

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Balance report | `grimoires/gygax/balance-reports/YYYY-MM-DD-scope-description.md` | Markdown with tables |

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Direct to `/attune` |
| Requested scope has no applicable data | "The game-state has no [combat mechanics / resource entities / progression data]. I can analyze [what does exist] instead." | Offer alternative scope |
| Incomplete entity data (e.g., attack with no damage listed) | Note the gap in the report's Methodology Notes section. Compute what is possible, mark missing values as "N/A (data missing: [field])". | Partial analysis with explicit gaps |
| Progression table has gaps (some levels defined, others not) | Interpolate linearly between known points. Note the interpolation in Methodology Notes. | Interpolated scaling |
| Tradition has no standard benchmarks (custom system) | Analyze internal consistency only (entities relative to each other). Do not compare against external baselines. | Relative analysis |
| User requests comparison but only one entity exists | "I can only find [entity A]. To compare, I need a second entity in game-state. Run `/attune` to add it, or specify a different entity." | Ask for clarification |
