---
name: delve
description: Analyze dungeons and environments for ecology, non-linearity, attrition, loot economies, and G.U.A.R.D. coherence
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
model_tier: opus
effort: large
---

# Delve

Dungeon analysis skill. Where `/homebrew` evaluates mechanics and `/cabal` evaluates play experience, `/delve` evaluates **environment** — spatial flow, inhabitant ecology, attrition curves, loot economies, and the structural coherence that separates a living world from a "monster zoo."

Dungeon design operates at a different abstraction level than mechanics. A dodge reaction and a dungeon are both "game content," but analyzing them requires different lenses. You can check whether a mechanic's math works in isolation. You cannot check whether a dungeon's ecology works in isolation — ecology is about relationships between inhabitants, architectural history, and the logic of why this creature is in this room.

Delve applies five analytical frameworks derived from decades of dungeon design theory: ecology classification, Xandering (non-linearity), attrition modeling, loot economy math, and the G.U.A.R.D. checklist.

This skill is **read-only** against game-state. Fixes go through `/homebrew`. Experimentation goes through `/scry`.

## Trigger

`/delve` with optional scope.

Examples:
- `/delve` -- analyze all dungeon entities in game-state
- `/delve the-signal-mine` -- focused analysis of one dungeon
- `/delve --ecology` -- ecology classification only (all dungeons)
- `/delve --xandering` -- non-linearity evaluation only
- `/delve --attrition` -- resource/attrition curve only
- `/delve --loot` -- loot economy math only
- `/delve --guard` -- G.U.A.R.D. checklist only
- `/delve the-signal-mine --ecology --xandering` -- focused scope, specific frameworks

Also triggered by natural language:
- "analyze this dungeon"
- "check the dungeon design"
- "dungeon ecology review"
- "does this dungeon work"
- "is this a monster zoo"

## Workflow

### Step 1: Load Game-State and Dungeons

1. Check `grimoires/gygax/game-state/index.yaml` exists. If not: "No game attuned yet. Run `/attune` first."
2. Read `design_parameters` from `index.yaml` if present. Use these to adjust analysis thresholds:
   - `target_session_length: short` → flag dungeons with high room counts (>8) as potential pacing slogs
   - `target_session_length: long` → raise room count threshold (>20 before flagging)
   - `target_audience: newcomer` → lower Xandering complexity thresholds (non-linearity can overwhelm new players)
   - `target_lethality: brutal` → expect and accept steeper attrition curves (don't flag fast resource drain as a problem)
   - `target_lethality: gentle` → flag encounters without clear escape routes or recovery points
   - `target_randomness: none` → flag procedural generation as a design mismatch (deterministic games shouldn't have random dungeons)
   - If no `design_parameters` set, use tradition defaults.
3. Glob for dungeon entities:
   - `grimoires/gygax/game-state/entities/*.yaml` where `subtype: dungeon`
   - `grimoires/gygax/game-state/entities/dungeons/**/*.yaml` (if multi-file dungeon structure used)
3. If no dungeons found, report: "No dungeon entities in game-state. Dungeons should have `subtype: dungeon` in the entity file. Would you like to attune a dungeon now?"
4. Load previous delve reports from `grimoires/gygax/delve-reports/*.md` for regression tracking.

### Step 2: Determine Scope

Parse the invocation:

| Scope | Effect |
|-------|--------|
| No args | All dungeons, all frameworks |
| Dungeon ID | One dungeon, all frameworks |
| Framework flag(s) | All dungeons, selected frameworks |
| ID + flags | One dungeon, selected frameworks |

### Step 3: Run Analyses

For each dungeon in scope, run each selected framework.

#### 3a: Ecology Analysis

**Classify the dungeon's inhabitant logic into one of four categories:**

| Category | Logic | Immersion |
|----------|-------|-----------|
| **Monster Zoo** | Creatures mixed by CR/visual appeal. No relationship logic. | Low — breaks immersion unless justified by narrative anomaly |
| **Thracia-style (Coherent History)** | Factions with hierarchies and active conflicts. Players can manipulate faction dynamics. | High — provides agency beyond combat |
| **Realistic Simulation** | Resource flow logic — food sources, water, waste, breeding habits. | High — naturalistic foreshadowing ("no prey = apex predator nearby") |
| **Theme-Based** | Commitment to narrative theme over architectural realism. Non-Euclidean spaces, dream logic. | High for specific emotional register |

**Detection:**
- Look at `rooms` / inhabitants in the dungeon entity
- Check for relationship fields (faction membership, hierarchy, predator-prey)
- Check for resource fields (food sources, water, waste)
- Check for theme fields (atmosphere, emotional target)

**Advanced check: "History Dictates Choice"**
- Are there architectural layers? (original builders vs current occupiers)
- Is there a "Marriage of Tolerance" — logical symbiotic relationship between creatures?
- Example from Caverns of Thracia: giant spider guards river pass; reptiles feed it captured humans; it serves as natural guardian.

**Flag:**
- Pure Monster Zoo with no justification → Warning
- Classified category doesn't match the dungeon's stated atmosphere → Contradiction
- Missing inhabitant ecology fields entirely → Info (recommendation to add)

#### 3b: Xandering / Non-Linearity Analysis

**Quantify non-linearity using the dungeon's architecture fields:**

| Metric | Source | Good Baseline |
|--------|--------|---------------|
| Multiple entrances | `architecture.entrances` | ≥ 2 |
| Loops | `architecture.loops` | ≥ 1 for dungeons of 5+ rooms |
| Secret paths | `architecture.secrets` | ≥ 1 per 5 rooms |
| Sub-levels (verticality) | `architecture.sub_levels` | ≥ 1 for dungeons of 10+ rooms |

**Diagnostic barometers:**

| Barometer | Evaluation |
|-----------|------------|
| Difficult vs Easy | Are some areas trivially connected while others require effort to reach? |
| Far vs Near | Do some areas feel close to entrance while others feel genuinely distant? |

**Landmarks check:**
- Are there memorable visual references in the room descriptions? (statues, stained glass, distinctive terrain)
- Without landmarks, non-linearity becomes "featureless sprawl" — navigation by memorization instead of recognition.

**Flag:**
- Single entrance, no loops, no secrets → Major finding: "This is a railroad, not a dungeon"
- Loops without landmarks → Warning: "Navigation will feel like corridors without character"
- High verticality without pathing clarity → Warning: "Players may get lost without landmarks"

#### 3c: Attrition Analysis

**Model resource depletion across the expected room sequence.**

This analysis uses probability scripts when available:
- Use `bell-curve.ts` if damage per encounter is defined with dice (e.g., 1d6 per trap, 2d4 per encounter)
- Use `dice-pool.ts` if the game uses pool-based resource costs

**Inputs:**
- `attrition.expected_rooms_before_rest` (from dungeon metadata)
- `attrition.resource_pressure_curve` (if designer has set it, e.g., `[light, light, medium, heavy, critical]`)
- Resources defined in `resources/*.yaml` — HP, stamina, spell slots, torches, rations
- Per-room encounters and their resource costs

**Analysis:**

1. Starting resources: what does a typical party bring in?
2. Expected depletion per room: average cost of the encounters/traps/environmental effects
3. Recovery opportunities: are there safe rooms, rest points, or recovery mechanics within the dungeon?
4. Net resource pressure at each milestone (room 1, 3, 5, etc.)
5. Identify dead zones (no pressure, boring) and critical points (near-depletion, high tension)

**Flag:**
- Pressure curve with no critical point → Warning: "No resource tension"
- Pressure reaches critical before room 3 → Major: "Death spiral — too hard too fast"
- No rest opportunity across 6+ rooms → Observation: "Tests resource management heavily; intentional?"

**Important:** Read the dungeon's `intent` field before classifying findings. If the designer's stated intent is "classic extraction run with escalating stakes," a severe pressure curve is the design, not a bug.

#### 3d: Loot Economy Analysis

**Model the loot distribution using probability scripts.**

Invokes `dice-probability.ts` for:
- Weighted bucket analysis (e.g., 1 Legendary / 10 Rare / 40 Common / 50 Gold → percentage probabilities)
- Pity timer math (rolling without replacement) — if configured
- Expected rolls before rare drop (1 / probability)

**Analysis:**

1. Total loot pool: sum all treasure/items across rooms
2. Rarity distribution: how many common vs rare vs legendary?
3. Item weight balance: if using weighted buckets, are the probabilities producing the intended feel?
4. RNG frustration: how many encounters/rooms before the expected "good drop"?
5. Pity timer sanity: if configured, does the timer fire before player frustration kicks in?

**Flag:**
- Legendary probability < 0.5% with no pity timer → Warning: "Players may never see legendary content"
- All loot is the same tier → Observation: "No rarity variation — is this intentional?"
- Loot value vs risk mismatch (high-risk room has low-value loot) → Minor: "Risk/reward inverted"

#### 3e: G.U.A.R.D. Checklist

Final pass across five dimensions. For each, pass/fail with specific evidence.

| Dimension | Question | Pass Evidence |
|-----------|----------|---------------|
| **Goals** | Is the dungeon's purpose clear from the structure? | Quest objective visible in entry, treasure rooms point toward reward, endpoint is recognizable |
| **Underlining themes** | Is the ecology coherent? | Thracia-style or better, layered history, no Monster Zoo violations |
| **Atmosphere** | Are landmarks evocative? | Memorable visual references, distinct room descriptions, sensory variety |
| **Risks** | Is attrition balanced with reward? | Resource pressure exists but isn't punishing; high-risk rooms have commensurate rewards |
| **Diversions** | Are there traps, puzzles, secret paths? | Non-combat challenges exist, break linearity, reward exploration |

Each dimension: PASS, PARTIAL, or FAIL with specific evidence.

### Step 4: Regression Check

Read previous delve reports. For each previous finding:
- Resolved (fixed)
- Persists (unchanged)
- Worsened (modifications made it worse)
- Evolved (changed character)

If no previous reports: "First delve run — no regression baseline."

### Step 5: Compile Findings

Organize findings by:
- **Severity:** Critical / Major / Minor / Observation / Non-obvious
- **Framework:** Ecology / Xandering / Attrition / Loot / G.U.A.R.D.

Apply intent awareness: if a dungeon has stated `intent`, findings that conflict with intent are:
- Warning → Observation ("working as designed per intent")
- Critical remains Critical
- Non-obvious always surfaces with `[INTENT-ALIGNED]` or `[INTENT-CONFLICT]` tag

### Step 6: Generate Report

Write to `grimoires/gygax/delve-reports/YYYY-MM-DD-{dungeon-id}.md`.

## Report Format

```markdown
# Delve Report: [Dungeon Name]

**Date:** YYYY-MM-DD
**Game:** [Game Name] ([tradition])
**Dungeon:** [dungeon-id] ([name])
**Game-State Version:** [last_modified_at] | [N] dungeon entities
**Frameworks Run:** [list]
**Previous Reports:** [count] (or "None -- first run")

## Executive Summary

[2-4 sentences: what was analyzed, the most important finding, overall dungeon health.]

## Ecology Analysis

**Classification:** [Monster Zoo | Thracia-style | Realistic Simulation | Theme-Based]

[Specific evidence for the classification. Which inhabitants. Which relationships. Which resource flows.]

**History Dictates Choice evaluation:**
- Architectural layers: [present/absent]
- Symbiotic relationships: [list]

### Findings
[Ecology-specific findings with severity]

## Xandering / Non-Linearity

**Metrics:**
| Metric | Count | Evaluation |
|--------|-------|------------|
| Entrances | N | [good/poor] |
| Loops | N | [good/poor] |
| Secret paths | N | [good/poor] |
| Sub-levels | N | [good/poor] |

**Diagnostic Barometers:**
- Difficult vs Easy: [present/absent]
- Far vs Near: [present/absent]

**Landmarks:** [list memorable references]

### Findings
[Xandering-specific findings]

## Attrition Analysis

**Resource Pressure Curve:**
[Room-by-room pressure evaluation]

**Script-backed calculations (if applicable):**
- Expected damage per encounter: [from bell-curve.ts]
- Net pressure at room N: [calculation]

### Findings
[Attrition-specific findings]

## Loot Economy

**Distribution:**
| Tier | Count | Probability | Pity Timer |
|------|-------|-------------|-----------|
| Legendary | N | X.XX% | [configured/none] |
| Rare | N | X.XX% | ... |

**Script-backed calculations:**
- Expected rolls for legendary: [N rolls]
- RNG frustration threshold: [evaluation]

### Findings
[Loot-specific findings]

## G.U.A.R.D. Scorecard

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Goals | PASS / PARTIAL / FAIL | [specific] |
| Underlining themes | ... | ... |
| Atmosphere | ... | ... |
| Risks | ... | ... |
| Diversions | ... | ... |

**Overall G.U.A.R.D. grade:** [N/5 passing]

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | N |
| Major | N |
| Minor | N |
| Observation | N |
| Non-obvious | N |

## Intent Alignment

[If dungeon has stated intent, evaluate how findings relate to it]

**Stated intent:** "[intent.summary]"
**Findings aligned with intent:** [count]
**Findings in conflict with intent:** [count]

## Regression Check

[Previous report comparison, if any]

## Recommended Next Steps

[Cross-skill chaining - specific invocations tied to findings]
- `/homebrew [entity]` -- address ecology incoherence in [finding #]
- `/homebrew [entity]` -- add non-linearity via [specific addition]
- `/augury [entity]` -- quantify resource pressure curve
- `/scry "[proposed change]"` -- test alternative loot distribution before committing
- `/cabal --newcomer [dungeon]` -- test whether first-time delvers can navigate without landmarks

[Each recommendation includes exact invocation and references specific findings.]
```

## Dungeon Entity Schema

Delve expects dungeons as `entities/*.yaml` with `subtype: dungeon`. Full schema:

```yaml
id: "the-signal-mine"
name: "The Signal Mine"
type: entities
subtype: dungeon
description: "Abandoned broadcast facility with layered inhabitant history"
tradition: custom
tags: [dungeon, extraction, vertical]

architecture:
  entrances: 3                # Multiple entrances for Xandering
  loops: 4                    # Interconnected paths
  secrets: 7                  # Hidden routes
  sub_levels: 2               # Vertical layers

ecology:
  classification: history-dictates-choice|monster-zoo|thracia|realistic|theme-based
  original_inhabitants: "engineers-long-dead"
  current_inhabitants: "feral-miberas"
  layered_narrative: "Mining equipment repurposed as shrine fixtures"
  symbiotic_relationships:
    - between: [creature-a, creature-b]
      type: "spider guards pass for reptile tribute of humans"

rooms:
  - id: entrance-hall
    landmark: "The broken transmitter"
    encounters: [feral-mibera-patrol]
    traps: []
    loot: []
  - id: control-room
    landmark: "The last broadcast screen"
    encounters: [apex-predator-signal-entity]
    traps: [radiation-leak]
    loot: [legendary-frequency-crystal]

attrition:
  expected_rooms_before_rest: 5
  resource_pressure_curve: [light, light, medium, heavy, critical]
  rest_opportunities: []       # Room IDs where rest is possible

loot:
  distribution_method: weighted-buckets|pity-timer|both|none
  weighted_buckets:
    legendary: {weight: 1, items: [frequency-crystal]}
    rare: {weight: 10, items: [old-chip, mining-laser]}
    common: {weight: 40, items: [scrap-metal, rad-suit]}
    currency: {weight: 50, items: [imperial-credit]}
  pity_timer:
    after_n_attempts: 20
    guaranteed_tier: rare

intent:
  summary: "Classic extraction run with escalating stakes"
  rationale: "Tests whether the party can manage resources across 5+ rooms without rest. Resource pressure is the core tension."
  set_by: designer
  set_at: "2026-04-15"
  non_negotiable: true

depends_on: [mechanics/rest.yaml, resources/rations.yaml]
affects: []
```

**For simple dungeons:** Use inline `rooms` array as above.

**For complex dungeons:** Split rooms into their own files at `entities/dungeons/{dungeon-id}/rooms/*.yaml`, referenced by ID in the parent dungeon file.

## Tradition Adaptation

Dungeon analysis patterns shift by tradition:

| Tradition | Emphasis |
|-----------|----------|
| d20 | CR-based attrition math; loot economy as progression gate |
| PbtA | Ecology as fiction source; front/threat structure; moves triggered by dungeon features |
| FitD | Score structure (setup/engagement/aftermath); clocks as dungeon timers |
| OSR | **Deep alignment** — OSR design philosophy matches delve's frameworks. Expect rich Xandering, resource attrition, "combat as war." Apply `/lore osr` heuristics aggressively. |
| Custom | Adapt — some games may have no combat, no traps, no loot. Delve classifies what EXISTS, flags absence only if dungeon purpose implies it. |

**OSR integration:** When the game's tradition is `osr`, delve additionally reads `skills/lore/resources/osr.yaml` heuristics and applies them. OSR dungeons should pass the "Combat as War vs Sport" test, the "Information as Treasure" test, and the "Weight of Choice" test.

## Boundaries

- Does NOT modify game-state files — read-only (use `/homebrew` to implement fixes)
- Does NOT design new dungeons (use `/homebrew` for that)
- Does NOT simulate play sessions through the dungeon (use `/cabal` for that)
- Does NOT perform isolated mechanic math (use `/augury` for that)
- Does NOT apply general design heuristics (use `/lore` for that; delve applies dungeon-specific frameworks only)
- DOES analyze ecology, non-linearity, attrition, loot, G.U.A.R.D. coherence
- DOES invoke probability scripts for attrition and loot math
- DOES read intent and adjust findings accordingly
- DOES check regressions against previous delve reports
- DOES adapt to tradition (especially OSR)
- Does NOT edit files in `.claude/` (System Zone)

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Delve report | `grimoires/gygax/delve-reports/YYYY-MM-DD-{dungeon-id}.md` | Markdown (report format above) |

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state | "No game attuned yet. Run `/attune` first." | Redirect to /attune |
| No dungeons in game-state | "No dungeon entities found. Dungeons should have `subtype: dungeon`. Would you like to attune a dungeon now?" | Offer /attune path |
| Scoped dungeon not found | "Dungeon '{id}' not found. Available dungeons: [list]. Did you mean one of these?" | List alternatives |
| Dungeon missing architecture fields | "Dungeon '{id}' has no `architecture` field. Xandering analysis requires structure data. Run `/homebrew {id}` to add it, or proceed with other frameworks only." | Partial analysis |
| Dungeon missing intent | "Dungeon '{id}' has no intent set. Findings will be classified without intent context. Set intent via `/homebrew --set-intent {id}`." | Proceed with warning |
| Probability script failure | "Attrition/loot math failed: [error]. Falling back to qualitative assessment." | Degrade gracefully |
| All frameworks produce no findings | "Clean scan. Your dungeon avoids known anti-patterns. Consider `/cabal --gm --newcomer` to test runnability." | Valid result |
