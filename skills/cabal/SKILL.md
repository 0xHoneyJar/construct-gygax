---
name: cabal
description: Simulate adversarial playtesting with synthetic player archetypes to stress-test TTRPG mechanics
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
model_tier: opus
effort: large
---

# Cabal

Simulate adversarial playtesting sessions with a cabal of synthetic player archetypes to stress-test TTRPG mechanics. Real playtesting is expensive, slow, and hard to reproduce. Cabal provides fast, repeatable, archetype-driven analysis that catches the kinds of problems real players find -- exploits, dead options, ambiguous rules, broken combos, and narrative-mechanical dissonance -- before those players ever sit down at the table.

Every TTRPG mechanic encounters four fundamental player orientations: the player who optimizes, the player who explores, the player who prioritizes story, and the player who reads every word of the rules. A mechanic that survives all four has been stress-tested from angles no single designer perspective can cover. Cabal runs all four simultaneously, adapting their behavior to the game's tradition.

This skill is **read-only** against game-state. Cabal never modifies `grimoires/gygax/game-state/`. It reads the current design, simulates how players would interact with it, and produces a playtest report with findings. Fixes go through `/homebrew`.

## Trigger

`/cabal` with optional scope argument.

Examples:
- `/cabal` -- general playtest of the full game-state
- `/cabal dodge-reaction` -- focused test of a specific mechanic
- `/cabal fighter-class` -- stress-test a class/playbook across archetypes
- `/cabal combat-encounter` -- simulate a representative combat encounter
- `/cabal resource-economy` -- test the resource pressure and recovery loop

Also triggered by natural language:
- "playtest this"
- "stress test"
- "will players break this"
- "find exploits"
- "what would a min-maxer do with this"

## Archetype Profiles

Four synthetic player archetypes form the cabal. Each archetype has distinct motivations, strategies, and blind spots. Their behavioral weightings shift by game tradition (see Tradition Adaptation below).

Full archetype definitions with per-tradition weightings are in `skills/cabal/resources/archetypes.yaml`.

### The Optimizer

**Motivation:** Win the game within the rules. Maximize output, minimize waste.

The Optimizer reads every mechanic as a resource conversion problem. They find the highest-DPR builds, the most efficient action economy sequences, the combos that produce multiplicative returns. They are the player who asks "what is the mathematically best choice here?" at every decision point.

**What they test for:**
- Dominant strategies that make all other options obsolete
- Resource conversion ratios that produce outsized returns
- Action economy exploits (doing more with less)
- Combo interactions the designer did not anticipate
- Trap options -- choices that look viable but are strictly inferior
- Scaling breakpoints where a mechanic goes from balanced to broken

| Weighting | Default | d20 | PbtA | FitD | OSR |
|-----------|---------|-----|------|------|-----|
| Risk tolerance | Medium | Medium | Low | High | Low |
| Optimization drive | Very High | Very High | High | High | Very High |
| System engagement | Deep | Deep | Moderate | Deep | Deep |
| Primary focus | Build efficiency | Build theory | Move selection | Action ratings | Procedure mastery |

### The Explorer

**Motivation:** See everything the game has to offer. Test the edges, not the center.

The Explorer ignores the optimal path and asks "what else can I do?" They take the subclass nobody picks, attempt the action the rules do not explicitly cover, and push into corners of the design space the designer may not have considered. They are the player who discovers that the grappling rules interact weirdly with the mounted combat rules because they are the only person who tried both at once.

**What they test for:**
- Dead design space -- options that exist but no one would choose
- Edge case interactions between unrelated subsystems
- Optional content that is disconnected from core play
- Breadth of viable character concepts
- "What happens if I try X?" questions the rules do not answer
- Accessibility barriers to non-standard playstyles

| Weighting | Default | d20 | PbtA | FitD | OSR |
|-----------|---------|-----|------|------|-----|
| Risk tolerance | High | High | Very High | High | Medium |
| Optimization drive | Low | Low | Very Low | Low | Medium |
| System engagement | Broad | Broad | Broad | Broad | Broad |
| Primary focus | Coverage | Multiclassing, feats | Custom moves, off-label | Flashbacks, Devil's Bargains | Rulings, procedures |

### The Storyteller

**Motivation:** Create a compelling narrative. Mechanics should serve the fiction.

The Storyteller evaluates every mechanic by asking "does this make the story better or worse?" They are sensitive to moments where mechanical optimization produces narratively absurd outcomes, where rules break immersion, and where the fiction and the mechanics point in different directions. They are the player who notices that the "optimal" combat strategy is to hide behind a wall and spam ranged attacks, which is mechanically correct but dramatically inert.

**What they test for:**
- Fiction-mechanics misalignment (optimal play produces bad stories)
- Dramatic inertia -- mechanics that produce static, repetitive play patterns
- Narrative dead ends where the rules prevent interesting story developments
- Feel-bad moments where the mechanics punish thematically appropriate choices
- Tone violations where a mechanic's implications clash with the game's genre
- Missing fictional positioning -- situations the fiction demands but mechanics cannot represent

| Weighting | Default | d20 | PbtA | FitD | OSR |
|-----------|---------|-----|------|------|-----|
| Risk tolerance | Medium | Medium | High | High | Medium |
| Optimization drive | Very Low | Very Low | Low | Low | Low |
| System engagement | Narrative | Narrative | Deep | Deep | Narrative |
| Primary focus | Fiction alignment | RP-mechanics gap | Moves as fiction | Position as fiction | Rulings as fiction |

### The Rules Lawyer

**Motivation:** Understand exactly what the rules say and expose every ambiguity.

The Rules Lawyer reads the mechanic as written (RAW), compares it to what the designer probably intended (RAI), and catalogues every gap between the two. They find the interactions that produce paradoxes, the conditions that have no defined resolution, and the edge cases where two rules contradict each other. They are the player who asks "but what happens if the grappler is also invisible AND the target is on a different plane?"

**What they test for:**
- RAW vs. RAI divergence (rules say X, designer probably meant Y)
- Undefined states -- situations the rules do not cover
- Contradictory interactions between mechanics
- Ambiguous trigger conditions (when exactly does this activate?)
- Scope creep in broad abilities ("at-will teleportation breaks everything")
- Missing failure states (what happens when the check fails? the rules are silent)
- Interaction edge cases between subsystems that were clearly designed independently

| Weighting | Default | d20 | PbtA | FitD | OSR |
|-----------|---------|-----|------|------|-----|
| Risk tolerance | Low | Low | Medium | Medium | Low |
| Optimization drive | Medium | Medium | Low | Medium | Medium |
| System engagement | Exhaustive | Exhaustive | Moderate | Deep | Exhaustive |
| Primary focus | Textual precision | RAW analysis | Trigger overlap | Clock/consequence gaps | Procedure gaps |

## Workflow

### Step 1: Load Game-State and Previous Reports

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If it does not, stop and tell the user: "No game attuned yet. Run `/attune` first to build your game-state."
2. Read `index.yaml` to get the full entity manifest: game name, tradition, entity counts, file list, and dependency graph summary.
3. Load the archetype definitions from `skills/cabal/resources/archetypes.yaml`. Adjust behavioral weightings based on the game's tradition.
4. Glob `grimoires/gygax/playtest-reports/*.md` to find previous playtest reports. Read them. Previous findings establish the regression baseline -- the cabal must check whether previously identified issues have been addressed, persist, or have been made worse by subsequent changes.
5. If this is the first cabal run (no previous reports), note that there is no regression baseline.

### Step 2: Determine Scenario Scope

Parse the user's invocation to determine what to test.

| Scope | Trigger | What gets loaded | Example |
|-------|---------|-----------------|---------|
| **Specific mechanic** | `/cabal dodge-reaction` | The named mechanic + all entities in its `depends_on` and `affects` graph | Test dodge in isolation and in combination |
| **Class/playbook** | `/cabal fighter-class` | The progression entity + all mechanics, resources, and entities it references | Test the full class from level 1 to endgame |
| **Encounter** | `/cabal combat-encounter` | All combat-tagged mechanics + resources + relevant entities | Simulate a representative combat |
| **Subsystem** | `/cabal resource-economy` | All resources + mechanics that cost or recover resources | Test the full resource pressure loop |
| **General** | `/cabal` | Full game-state (all entities) | Broad sweep across the entire design |

For each scope, load the relevant subset of game-state YAML files. For general scope, load everything but prioritize entities with the most cross-references (from `dependency_graph_summary.most_depended_on`).

### Step 3: Simulate Archetype Interactions

For each of the four archetypes, simulate how that player type would interact with the scoped game content. This is the core of the skill.

**For The Optimizer:**
1. Identify every resource-to-effect conversion in the loaded mechanics.
2. Calculate or estimate efficiency ratios. Which conversions yield the most output per input?
3. Look for combo interactions: do any two mechanics multiply each other's effectiveness?
4. Check for dominant strategies: is there a single best approach that makes all alternatives suboptimal?
5. Test at multiple progression points (early, mid, late game) if progression data exists.
6. Flag trap options -- mechanics that appear balanced but are strictly inferior to alternatives.

**For The Explorer:**
1. Enumerate all the choices a player can make within the scoped content.
2. For each choice, ask: does this choice lead to meaningfully different play experiences?
3. Identify dead branches -- options that exist but produce strictly worse or uninteresting outcomes.
4. Test unusual combinations: what if a player combines mechanics from unrelated subsystems?
5. Look for missing coverage: are there play fantasies the system implies but cannot support?
6. Check for accessibility: can a player who does not read optimization guides still build a functional character?

**For The Storyteller:**
1. For each mechanic, simulate a fictional scenario where it would be used.
2. Does the mechanically optimal action also produce the most interesting narrative outcome?
3. If not, how large is the gap? (Small: "slightly suboptimal but fine." Large: "the game actively punishes good storytelling.")
4. Look for dramatic inertia: do the mechanics encourage repetitive action patterns?
5. Check for feel-bad moments: when the fiction says "your character would do X" but the mechanics say "X is terrible, do Y instead."
6. For PbtA/FitD: do move triggers create interesting fictional positioning, or do they feel like a menu?

**For The Rules Lawyer:**
1. Read every mechanic in scope as RAW (Rules As Written). What does the text literally say?
2. Identify every ambiguity: undefined terms, missing failure states, unclear trigger conditions.
3. Construct edge cases: what happens when two mechanics trigger simultaneously? When a condition references something that does not exist in the current game state?
4. Check for contradictions: do any two mechanics produce mutually exclusive outcomes in the same situation?
5. Test scope boundaries: how far can a broadly worded ability be stretched RAW?
6. For each ambiguity found, assess: is this a problem (will cause table arguments) or a feature (intended design space for GM rulings)?

### Step 4: Identify Findings Per Archetype

For each archetype, compile findings with severity, description, and evidence.

**Severity levels:**

| Severity | Meaning | Example |
|----------|---------|---------|
| **Critical** | The mechanic is broken -- produces degenerate, non-functional, or game-stopping results | "Infinite damage loop via combo of X + Y" |
| **Major** | Significant design problem that will affect most play sessions | "Dodge is strictly better than Shield in every scenario -- Shield is a trap option" |
| **Minor** | Notable issue that affects edge cases or specific player types | "Grappling has no defined interaction with flying creatures" |
| **Observation** | Not a problem per se, but worth the designer's awareness | "The resource recovery rate means combat encounters longer than 4 rounds become attrition tests" |
| **Non-obvious** | A subtle interaction or emergent behavior the designer likely did not anticipate (goal G-3) | "The reaction economy means that a character who uses dodge cannot also use opportunity attacks -- this creates an implicit tank/striker role split that is never stated in the rules" |

**Every cabal run must produce at least one non-obvious finding.** This is goal G-3: Cabal exists to find things the designer did not already know. If the analysis only confirms what is obvious, dig deeper. Look for second-order effects, emergent role differentiation, pacing implications, and cross-session dynamics.

**Finding format:**

```
[ARCHETYPE] [SEVERITY]: One-line summary
  Description: Full description of the finding
  Evidence: Specific game-state entities and values that support the finding
  Recommendation: Suggested next step (which skill to use, what question to investigate)
```

### Step 5: Regression Check

Compare current findings against previous playtest reports.

1. For each finding in previous reports, check: does the current game-state still exhibit this issue?
2. Classify each previous finding as:
   - **Resolved** -- the issue no longer exists (the game-state has changed to address it)
   - **Persists** -- the issue still exists unchanged
   - **Worsened** -- subsequent changes have made the issue more severe
   - **Evolved** -- the issue has changed character (e.g., was a balance problem, now is a different balance problem)
3. If there are no previous reports, skip this step and note "First cabal run -- no regression baseline."

### Step 6: Generate Report

Write the playtest report to `grimoires/gygax/playtest-reports/YYYY-MM-DD-scope-description.md`.

Use the Report Format defined below. The report must include:
- Session metadata (date, scope, tradition, game name)
- Summary of findings by severity count
- Per-archetype sections with detailed findings
- Non-obvious findings highlighted
- Regression section (if previous reports exist)
- Recommended next steps (specific skill invocations)

## Tradition Adaptation

Archetype behavior shifts based on the game's tradition. The same archetype asks different questions in different design contexts.

### d20 Systems (D&D, Pathfinder, 13th Age)

| Archetype | Focus Shift | Key Questions |
|-----------|------------|---------------|
| Optimizer | Build theory, feat chains, multiclass dips, nova rounds | What is the highest DPR at each tier? Which feat/multiclass combos break bounded accuracy? |
| Explorer | Unusual multiclass paths, underused skills, tool proficiencies, non-combat options | Can you build a viable character around Perform? What happens if you never take Extra Attack? |
| Storyteller | RP-mechanics gap, alignment as mechanic, background features, social pillar | Does optimizing for combat make you useless in social encounters? Do backgrounds matter mechanically? |
| Rules Lawyer | Saving throw stacking, condition interactions, concentration limits, RAW spell readings | Can you concentrate on two effects via a multiclass loophole? What exactly constitutes "a creature you can see"? |

### PbtA Systems (Dungeon World, Apocalypse World, Monsterhearts)

| Archetype | Focus Shift | Key Questions |
|-----------|------------|---------------|
| Optimizer | Move selection efficiency, stat highlighting, advance priorities | Which moves trigger most often? Is there a stat that dominates? |
| Explorer | Custom moves, off-label move usage, playbook boundary testing | What happens when the fiction demands something no move covers? Can you play against your playbook's grain? |
| Storyteller | Move-as-fiction alignment, 7-9 result quality, GM move diversity | Do 7-9 results produce interesting fiction or just "lesser success"? Do the moves create stories or resolve them? |
| Rules Lawyer | Trigger overlap between moves, "when" vs. "if" wording, implicit vs. explicit permissions | When two move triggers apply, which fires? Does "when you do X" mean you must roll or may roll? |

### FitD Systems (Blades in the Dark, Scum & Villainy)

| Archetype | Focus Shift | Key Questions |
|-----------|------------|---------------|
| Optimizer | Action rating investment, stress economy, crew ability synergy | Which action ratings give the most versatility? How many stress per score is sustainable? |
| Explorer | Flashback edge cases, Devil's Bargain creativity, downtime action variety | Can flashbacks retroactively change anything? What is the weirdest viable Devil's Bargain? |
| Storyteller | Position/effect as narrative tool, clock fiction, faction turn drama | Does position/effect actually produce varied fiction or just varied numbers? Do clocks feel like story or accounting? |
| Rules Lawyer | Clock advancement ambiguity, resistance roll edge cases, consequence severity calibration | When exactly does a clock tick? Can you resist a consequence that has already been narrated? |

### OSR Systems (Cairn, Knave, Into the Odd)

| Archetype | Focus Shift | Key Questions |
|-----------|------------|---------------|
| Optimizer | Inventory management, hireling economy, procedure exploitation | What is the optimal loadout? Can hirelings be used to bypass risk entirely? |
| Explorer | Procedure gaps, ruling precedent, emergent tactics from minimal rules | What happens when the rules are silent? How many viable approaches exist for a given obstacle? |
| Storyteller | Lethality as narrative, random table fiction, emergent story from procedures | Does high lethality serve the fiction or just punish investment? Do random tables produce coherent stories? |
| Rules Lawyer | Save-or-die scope, damage type interactions, procedure ordering ambiguity | When exactly do you roll a save? Does "direct damage" include environmental effects? |

## Report Format

Reports follow this structure. Every section is mandatory.

```markdown
# Playtest Report: [Scope Description]

**Date:** YYYY-MM-DD
**Game:** [Game Name]
**Tradition:** [tradition]
**Scope:** [specific mechanic | class/playbook | encounter | subsystem | general]
**Entities Tested:** [count] entities loaded from game-state
**Previous Reports:** [count] (or "None -- first run")

## Executive Summary

[2-4 sentences: what was tested, the most important finding, and the overall health assessment.]

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | N |
| Major | N |
| Minor | N |
| Observation | N |
| Non-obvious | N |

## The Optimizer

### Approach
[1-2 sentences: what the Optimizer tried to do with this design.]

### Findings
[Each finding in the standard format: severity, summary, description, evidence, recommendation.]

## The Explorer

### Approach
[1-2 sentences: what the Explorer tried to do with this design.]

### Findings
[Each finding in the standard format.]

## The Storyteller

### Approach
[1-2 sentences: what the Storyteller tried to do with this design.]

### Findings
[Each finding in the standard format.]

## The Rules Lawyer

### Approach
[1-2 sentences: what the Rules Lawyer tried to do with this design.]

### Findings
[Each finding in the standard format.]

## Non-Obvious Findings

[Dedicated section pulling together all non-obvious findings from all archetypes, with additional analysis of second-order effects and emergent dynamics.]

## Regression Check

[If previous reports exist:]
| Previous Finding | Status | Notes |
|-----------------|--------|-------|
| [finding summary] | Resolved / Persists / Worsened / Evolved | [explanation] |

[If no previous reports:]
First cabal run. No regression baseline established. This report becomes the baseline for future runs.

## Recommended Next Steps

[Specific, actionable recommendations tied to Gygax skills:]
- `/homebrew [mechanic]` -- to address [finding]
- `/augury [mechanic]` -- to quantify [finding]
- `/lore [topic]` -- to check [finding] against known patterns
- `/cabal [narrower scope]` -- to investigate [finding] more deeply
```

## Boundaries

- Does NOT modify game-state files -- Cabal is strictly read-only against `grimoires/gygax/game-state/` (use `/homebrew` to implement fixes)
- Does NOT design new mechanics (use `/homebrew` for that)
- Does NOT perform isolated numerical analysis with probability distributions (use `/augury` for that)
- Does NOT ingest source material (use `/attune` for that)
- Does NOT apply tradition heuristic libraries (use `/lore` for that)
- Does NOT replace real playtesting -- Cabal catches structural issues but cannot simulate social dynamics, table culture, or GM improvisation
- Does NOT produce definitive verdicts -- findings are hypotheses for the designer to evaluate, not mandates
- DOES simulate adversarial and non-adversarial player behavior across four distinct archetypes
- DOES check for regressions against previous playtest runs
- DOES adapt archetype behavior to the game's tradition
- DOES guarantee at least one non-obvious finding per run (goal G-3)

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Playtest report | `grimoires/gygax/playtest-reports/YYYY-MM-DD-scope-description.md` | Markdown (report format above) |

Reports accumulate over time. Each run adds a new report. Previous reports are never overwritten -- they form the regression baseline.

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Redirect to `/attune` |
| Scoped entity not found | "I can't find `[id]` in game-state. Here's what exists: [list]. Did you mean one of these?" | Offer alternatives |
| Game-state is too sparse for meaningful analysis | "Game-state only has [N] entities. Cabal works best with at least stats, resources, and core mechanics defined. Run `/attune` to flesh out the game-state, or `/cabal` will do what it can with what exists." | Proceed with caveats |
| No findings at non-obvious severity | Dig deeper. Re-examine cross-entity interactions, second-order effects, pacing implications, and multi-session dynamics. A cabal run without a non-obvious finding has not looked hard enough. | Mandatory re-analysis |
| Previous report references entities that no longer exist | Note the entity removal in the regression check as "Resolved (entity removed from game-state)" | Document in regression section |
