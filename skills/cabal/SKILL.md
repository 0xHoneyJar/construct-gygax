---
name: cabal
description: Scenario-based playtest simulation with 9 player archetypes and experience tracking
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
model_tier: opus
effort: large
---

# Cabal

Simulate playtesting sessions with a roster of 9 synthetic player archetypes. Each archetype represents a distinct player orientation — from the optimizer who min-maxes every mechanic to the newcomer who has never played a TTRPG before. Users compose their own panel for each run. The simulation walks each archetype through a concrete scenario beat by beat, tracking experience signals and surfacing moments where different player types have radically different experiences of the same design.

Real playtesting is expensive, slow, and hard to reproduce. Cabal provides fast, repeatable, archetype-driven analysis that catches the kinds of problems real players find — exploits, dead options, ambiguous rules, broken combos, accessibility barriers, cognitive overload, and narrative-mechanical dissonance — before those players ever sit down at the table.

This skill is **read-only** against game-state. Cabal never modifies `grimoires/gygax/game-state/`. It reads the current design, simulates how players would interact with it, and produces a playtest report with findings. Fixes go through `/homebrew`.

## Trigger

`/cabal` with optional scope and archetype flags.

Examples:
- `/cabal` -- context-aware default panel, auto-generated scenario
- `/cabal dodge-reaction` -- focused test of a specific mechanic
- `/cabal --optimizer --newcomer --gm session-arc` -- explicit panel + scenario
- `/cabal --all "first session character creation"` -- all 9 archetypes, specific scenario
- `/cabal --anxious --newcomer` -- accessibility-focused review

Also triggered by natural language:
- "playtest this"
- "stress test"
- "will players break this"
- "is this accessible to new players"
- "can a GM run this"

## Archetype Roster

9 archetypes, each testing a distinct dimension of the design. Full behavioral profiles with per-tradition weightings are in `skills/cabal/resources/archetypes.yaml`.

| Archetype | Flag | Motivation | Tests For |
|-----------|------|-----------|-----------|
| **Optimizer** | `--optimizer` | Win within the rules. Maximize output. | Dominant strategies, exploits, trap options, scaling breaks |
| **Explorer** | `--explorer` | See everything. Test the edges. | Dead design space, edge cases, breadth, accessibility |
| **Storyteller** | `--storyteller` | Create compelling narrative. | Fiction-mechanics alignment, dramatic inertia, feel-bad moments |
| **Rules Lawyer** | `--rules-lawyer` | Expose every ambiguity. | RAW vs RAI, contradictions, undefined states, scope creep |
| **Newcomer** | `--newcomer` | First TTRPG ever. No conventions. | Accessibility, onboarding friction, jargon, self-teaching |
| **Chaos Agent** | `--chaos-agent` | Go off-script. "I befriend the monster." | Graceful degradation, GM improvisation load, uncovered actions |
| **GM** | `--gm` | Run the game behind the screen. | Cognitive load, prep needs, improvisation space, spotlight |
| **Anxious Player** | `--anxious` | Overwhelmed by choices, afraid of mistakes. | Decision paralysis, failure harshness, recovery, option overload |
| **Veteran** | `--veteran` | 50+ sessions deep. Seeks sustained depth. | Long-term engagement, mastery plateau, emergent complexity |

**For non-traditional games**: Archetypes adapt to ANY game. In a journaling RPG, the Optimizer finds prompt sequences that produce the most dramatic entries. In a GMless game, the Rules Lawyer probes authority distribution. If an archetype genuinely cannot engage (e.g., Optimizer in a game with no mechanical choices), report that explicitly -- "The Optimizer has nothing to optimize, which may indicate the game lacks mechanical depth for players who want it" -- that IS a finding.

## Panel Selection

### User-Composed Panels

Users select archetypes via flags:

```
/cabal --optimizer --newcomer --gm     # These 3 only
/cabal --all                           # All 9
/cabal --all --no-veteran              # All except Veteran
```

### Context-Aware Defaults

When no flags are provided, Cabal selects a panel based on what's being tested:

| Scenario Type | Default Panel | Rationale |
|---------------|--------------|-----------|
| New mechanic | Optimizer, Rules Lawyer, Newcomer | Exploitable? Clear? Accessible? |
| Combat encounter | Optimizer, Storyteller, GM | Efficient? Dramatic? Runnable? |
| Session arc | Optimizer, Storyteller, Newcomer, GM, Veteran | Broad coverage across session length |
| Character creation | Explorer, Anxious Player, Newcomer | Breadth? Overwhelming? Accessible? |
| Specific entity (class/playbook) | Optimizer, Explorer, Veteran | Build depth, options, sustained engagement |
| Full game review | All 9 | Comprehensive |

The panel selection and rationale are documented in every report header.

## Workflow

### Step 1: Load Game-State and Previous Reports

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If not: "No game attuned yet. Run `/attune` first."
2. Read `index.yaml` for the full entity manifest.
3. Load archetype definitions from `skills/cabal/resources/archetypes.yaml`. Adjust behavioral weightings based on the game's tradition.
4. Glob `grimoires/gygax/playtest-reports/*.md` for previous reports. Read them for regression baseline.
5. If first run, note: "No regression baseline."

### Step 2: Assemble Panel

1. Parse archetype flags from invocation. If explicit flags, use those.
2. If no flags, determine scenario type from the invocation and select context-aware default panel (see table above).
3. State the panel selection in the output: "Panel: Optimizer, Rules Lawyer, Newcomer (selected for new mechanic review)"

### Step 3: Construct Scenario

Parse the user's invocation to determine the scenario.

**If user provided a scenario**: Parse it. Identify the temporal scale:
- **Moment**: A single mechanic activation or decision point
- **Encounter**: A complete combat, social encounter, or exploration scene
- **Session**: A full session arc (opening → escalation → climax → wind-down)
- **Campaign arc**: Character progression across multiple sessions

**If no scenario provided**: Auto-generate from game-state:
1. Read `index.yaml` dependency graph. Identify the most interconnected mechanics (`most_depended_on`).
2. Construct a representative scenario that exercises those mechanics at the appropriate scale.
3. For scoped invocations (`/cabal dodge-reaction`), build the scenario around that specific mechanic.

**Decompose into beats**: Break the scenario into discrete decision points or events. Each beat is a moment where an archetype must perceive, choose, and experience an outcome.

### Step 4: Run Walkthrough

For each archetype in the panel, walk through the scenario beat by beat.

At each beat, document:

```
Beat N: [situation description]
  {Archetype} sees: [perception given their orientation and experience level]
  {Archetype} chooses: [action and reasoning]
  Resolution: [mechanical outcome]
  Experience signal: [one of the 8 signals]
  Signal rationale: [why this signal, grounded in specific game-state entities]
```

**Walkthrough guidelines:**
- Be concrete. Reference specific game-state entity values, not abstractions.
- Each archetype's "sees" should reflect their actual knowledge level. The Newcomer does not know what "action economy" means. The Veteran knows every interaction.
- Each archetype's "chooses" should follow their behavioral weightings. The Optimizer picks the mathematically best option. The Chaos Agent does something unexpected.
- Resolution uses the actual mechanics from game-state. Roll outcomes, resource costs, consequences.
- Every beat gets exactly one experience signal per archetype.

### Step 5: Track Experience Signals

Each signal has concrete, mechanically-grounded triggers:

| Signal | Triggers When | Most Sensitive Archetypes |
|--------|--------------|--------------------------|
| **Confusion** | Mechanic references undefined concepts, uses unexplained jargon, has ambiguous trigger conditions, or requires knowledge the archetype does not have | Newcomer, Anxious Player |
| **Excitement** | Resolution produces a dramatic outcome, a combo works as hoped, fiction reaches a peak moment, or a meaningful choice pays off | Storyteller, Veteran |
| **Dead time** | No meaningful action available, turn produces no impact, waiting for other archetypes, or mechanic is irrelevant to this archetype | Explorer, Veteran |
| **Decision paralysis** | More than 5 viable options with unclear relative value, consequences of failure are severe and unclear, or no guidance on what a "good" choice looks like | Anxious Player, Newcomer |
| **Frustration** | Optimal play is obvious but boring, thematically appropriate action is mechanically punished, system feels unfair, or effort is not rewarded | Optimizer, Rules Lawyer |
| **Cool moment** | Emergent interaction produces something unplanned, system and fiction align to create a memorable beat, or mastery creates an unexpectedly satisfying outcome | Storyteller, Explorer, Veteran |
| **Cognitive overload** | More than 3 active mechanical states to track simultaneously, resolution requires consulting multiple subsystems, or too many things happening at once to process | GM, Newcomer |
| **Mastery reward** | A non-obvious mechanical choice produces a meaningfully better outcome than the obvious choice, or deep system knowledge creates an advantage | Optimizer, Veteran |

**Signal rules:**
- Every beat gets exactly one signal per archetype.
- Signals must be grounded: "Confusion because DOSE threshold is referenced but never explained in the mechanic description" -- not "this seems confusing."
- If no strong signal applies, use the one closest to the archetype's experience at that moment.

### Step 6: Detect Experience Divergence

After all archetypes complete the walkthrough, cross-compare signals at each beat.

**Flag divergence when:**
- Two or more archetypes have opposite signals at the same beat (e.g., Optimizer: Excitement, Newcomer: Confusion)
- One archetype has Dead time while 2+ others are actively engaged
- The GM has Cognitive overload while players have Excitement
- An archetype meant to enjoy this scenario (based on panel selection rationale) is experiencing Frustration or Confusion

**Divergence severity:**
- **HIGH**: Opposite signals between archetypes (Excitement vs. Confusion, Mastery reward vs. Decision paralysis)
- **MEDIUM**: One archetype disengaged while others are engaged (Dead time vs. anything active)
- **LOW**: Same general valence but different intensity

**Divergence findings** are a first-class output. They represent invisible fractures in the design -- problems that only emerge when you compare across player types.

### Step 7: Regression Check

Compare current findings against previous playtest reports.

1. For each finding in previous reports, check: does the current game-state still exhibit this issue?
2. Classify each previous finding as:
   - **Resolved**: The issue no longer exists
   - **Persists**: The issue still exists unchanged
   - **Worsened**: Subsequent changes made the issue more severe
   - **Evolved**: The issue has changed character

### Step 8: Generate Report

Write to `grimoires/gygax/playtest-reports/YYYY-MM-DD-scope-description.md`.

## Report Format

```markdown
# Playtest Report: [Scope Description]

**Date:** YYYY-MM-DD
**Game:** [Game Name] ([tradition])
**Panel:** [archetype list] -- [selection rationale]
**Scenario:** [description] ([scale: moment|encounter|session|campaign-arc])
**Entities Tested:** [count]
**Previous Reports:** [count] (or "None -- first run")

## Executive Summary

[2-4 sentences: what was tested, most important finding, overall health.]

## Scenario

[The scenario broken into beats with fiction and mechanical context.]

### Beat 1: [description]
[Situation, stakes, available actions]

### Beat 2: [description]
...

## Walkthrough: [Archetype Name]

### Approach
[1-2 sentences: how this archetype engaged with the scenario.]

### Beat-by-Beat

| Beat | Sees | Chooses | Outcome | Experience |
|------|------|---------|---------|------------|
| 1 | [perception] | [action + reasoning] | [resolution] | Excitement |
| 2 | [perception] | [action + reasoning] | [resolution] | Confusion |
| ... | | | | |

### Findings

[Standard format per finding:]
[ARCHETYPE] [SEVERITY]: One-line summary
  Description: Full description
  Evidence: Specific game-state entities and values
  Recommendation: Suggested next step (which skill, what question)

[Repeat ## Walkthrough section for each archetype in panel]

## Experience Divergence

Moments where archetypes had radically different experiences of the same design.

| Beat | [Archetype A] | [Archetype B] | [Archetype C] | Divergence |
|------|---------------|---------------|---------------|------------|
| 2 | Excitement | Confusion | Dead time | HIGH |
| 5 | Mastery reward | Decision paralysis | -- | MEDIUM |

### Analysis

[What the divergence means for the design. Which player types are being served well vs. poorly. Specific game-state entities that cause the divergence.]

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | N |
| Major | N |
| Minor | N |
| Observation | N |
| Non-obvious | N |
| Divergence | N |

## Regression Check

[If previous reports exist:]
| Previous Finding | Status | Notes |
|-----------------|--------|-------|
| [finding] | Resolved / Persists / Worsened / Evolved | [explanation] |

[If no previous reports:]
First cabal run. No regression baseline established.

## Recommended Next Steps

[Cross-skill chaining: specific invocations tied to findings.]
- `/homebrew [mechanic]` -- to address [finding #N]
- `/augury [mechanic]` -- to quantify [finding #N]
- `/lore [topic]` -- to check [finding #N] against known patterns
- `/cabal [narrower scope]` -- to investigate [finding #N] more deeply
- `/scry "[proposed change]"` -- to explore a fix before committing

[Each recommendation must include the exact invocation and reference a specific finding number.]
```

## Tradition Adaptation

Archetype behavior shifts based on the game's tradition. The same archetype asks different questions in different design contexts. Per-tradition behavioral weightings are defined in `skills/cabal/resources/archetypes.yaml` for all 9 archetypes.

**For custom tradition**: Archetypes adapt based on what the game actually does, not what any standard tradition assumes. A custom game's core loop determines which archetypes have the most to contribute. If the game's core loop is "draw prompt, write, reflect" (journaling RPG), the GM archetype may have nothing to test -- that itself is a finding about the game's design scope.

## Boundaries

- Does NOT modify game-state files -- Cabal is strictly read-only against `grimoires/gygax/game-state/` (use `/homebrew` to implement fixes)
- Does NOT design new mechanics (use `/homebrew` for that)
- Does NOT perform isolated numerical analysis (use `/augury` for that)
- Does NOT ingest source material (use `/attune` for that)
- Does NOT apply tradition heuristic libraries (use `/lore` for that)
- Does NOT replace real playtesting -- Cabal catches structural issues but cannot simulate social dynamics, table culture, or spontaneous creativity
- Does NOT produce definitive verdicts -- findings are hypotheses for the designer to evaluate
- DOES simulate 9 distinct player orientations with scenario-based walkthroughs
- DOES track experience signals per archetype per beat
- DOES detect experience divergence across archetypes
- DOES check for regressions against previous playtest runs
- DOES adapt archetype behavior to the game's tradition
- DOES guarantee at least one non-obvious finding per run
- Does NOT edit files in `.claude/` (System Zone)

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Playtest report | `grimoires/gygax/playtest-reports/YYYY-MM-DD-scope-description.md` | Markdown (report format above) |

Reports accumulate over time. Each run adds a new report. Previous reports are never overwritten -- they form the regression baseline.

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Redirect to `/attune` |
| Invalid archetype flag | "Unknown archetype `--foo`. Available: --optimizer, --explorer, --storyteller, --rules-lawyer, --newcomer, --chaos-agent, --gm, --anxious, --veteran, --all" | Show available flags |
| Scoped entity not found | "I can't find `[id]` in game-state. Here's what exists: [list]. Did you mean one of these?" | Offer alternatives |
| Game-state too sparse | "Game-state only has [N] entities. Cabal works best with at least stats, resources, and core mechanics. Run `/attune` to add more, or provide a specific scenario." | Proceed with caveats |
| No findings at non-obvious severity | Dig deeper. Re-examine cross-archetype divergence, second-order effects, pacing implications. A cabal run without a non-obvious finding has not looked hard enough. | Mandatory re-analysis |
| Previous report references removed entities | Note removal in regression check: "Resolved (entity removed from game-state)" | Document in regression section |
| Archetype cannot engage with game | Report that explicitly: "The [Archetype] has nothing to [action] -- this may indicate the game lacks [dimension] for players who want it." | This IS a finding |
