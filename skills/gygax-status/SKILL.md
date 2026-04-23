---
name: gygax-status
description: Game health dashboard — cross-skill synthesis, prioritized findings, trajectory tracking
model_tier: sonnet
effort: medium
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash
---

# Gygax Status

Health dashboard for the Gygax construct. Shows the current state of the attuned game, synthesizes findings across all analysis skills, surfaces what's working well, and recommends what to do next. This is the "where am I and what matters most?" command.

## Trigger

`/gygax`

No arguments. Always produces the dashboard for the current project state.

## Workflow

### Step 1: Check Game-State Existence

1. Check if `grimoires/gygax/game-state/index.yaml` exists.
2. If it does NOT exist, display a short message and stop:
   ```
   No game attuned. Run /attune to onboard a game system.
   ```
   Do not proceed further.

### Step 2: Load Index and Display Identity

1. Read `grimoires/gygax/game-state/index.yaml`.
2. Extract: `game`, `tradition`, `description`, `last_modified_at`, `entity_count`, `design_parameters`, `graph_integrity`.
3. Display game identity as the dashboard header:

```
== Gygax Status ==

Game:      [name] ([tradition])
           [description]
Modified:  [last_modified_at]
Entities:  [total] total ([type]: [count], ...)
Graph:     [resolved] resolved refs, [stubs] stubs, [orphaned] orphaned, [circular] circular
Design:    session=[val], audience=[val], variance=[val], ...
```

- Omit entity types with zero count.
- If stubs exist, note count: `(includes N stubs)`.
- For design parameters, show `(default)` for fields not explicitly set.
- If no `design_parameters` section: "Design parameters: not set (tradition defaults apply)."

### Step 3: Collect All Report Findings

This is the core synthesis step. Read findings from all report types.

#### 3a: Augury Reports (Balance)

1. Glob `grimoires/gygax/balance-reports/*.md`.
2. For each report (up to last 3, most recent first):
   - Read the report. Extract the **Executive Summary** and **findings table**.
   - For each finding, capture: `finding_id`, `severity` (Critical/Warning/Info/Healthy), `layer` (resolution/action-economy/resource-economy/progression/pacing/cognitive-load), `description`, `affected_entities` (file paths), and any intent tags (`[INTENT-ALIGNED]`, `[INTENT-CONFLICT]`).
   - Note `[Healthy]` findings separately — these are strengths.

#### 3b: Cabal Reports (Playtest)

1. Glob `grimoires/gygax/playtest-reports/*.md`.
2. For each report (up to last 3):
   - Read the report. Extract the **Experience Divergence Matrix** and **Rules Clarity Issues**.
   - For each divergence, capture: `beat`, `divergence_severity` (HIGH/MEDIUM/LOW), `archetypes_involved`, `affected_entities`, `description`.
   - For rules clarity issues, capture: `severity`, `description`, `affected_entities`.
   - Note archetype-specific **Cool moment** and **Mastery reward** signals — these are strengths.

#### 3c: Lore Reports (Heuristics)

1. Glob `grimoires/gygax/lore-reports/*.md`.
2. For each report (up to last 3):
   - Read the report. Extract findings by severity.
   - For each finding, capture: `heuristic_name`, `severity` (Critical/Warning/Info), `affected_entities`, `tradition_context`, intent tags.
   - Note clean scans — "No issues detected" is a strength.

#### 3d: Delve Reports (Dungeons)

1. Glob `grimoires/gygax/delve-reports/*.md`.
2. For each report (up to last 3):
   - Read the report. Extract the **G.U.A.R.D. scorecard** and any flagged issues.
   - Capture findings with severity and affected entities.

### Step 4: Synthesize Findings

Cross-reference findings from all skills into a unified priority list.

#### 4a: Group by Entity

Build a map of `entity_path → [findings from all skills]`. An entity flagged by multiple skills is a stronger signal than one flagged by a single skill.

#### 4b: Identify Corroborations

When two or more skills flag the same entity or pattern:
- Lore says "hoarding incentive" + Augury says "resource never depletes" → corroborated finding about resource economy.
- Augury says "low variance resolution" + Cabal says "Optimizer: Dead time" → corroborated finding about mechanical flatness.
- Tag these: `[corroborated: augury + lore]`.

#### 4c: Identify Contradictions

When skills disagree about the same entity:
- Augury says "balanced" + Cabal says "Optimizer exploits this" → structural balance doesn't match play experience.
- Augury says "Warning: resource drains fast" + Cabal says "players don't feel pressure" → the math doesn't match the table experience.
- Tag these: `[contradiction: augury vs cabal]`. These are the most interesting findings — they reveal where theory diverges from practice.

#### 4d: Rank Findings

Score each finding for the priority list:

1. **Severity weight**: Critical = 4, Warning = 3, HIGH divergence = 3, Info = 1
2. **Cross-skill multiplier**: finding appears in 2+ skills × 1.5, 3+ skills × 2.0
3. **Contradiction bonus**: +2 (contradictions need designer attention regardless of severity)
4. **Intent modifier**: `[INTENT-ALIGNED]` findings get severity halved (acknowledged by design), `[INTENT-CONFLICT]` findings get +1 (working against stated goals)

Sort by final score descending. Keep the top 5-7 findings for the dashboard.

### Step 5: Display Game Health

This is the headline section of the dashboard. It goes right after the identity block.

#### 5a: Health Summary (one line)

Based on the finding distribution across all reports:

- **All clear**: No Critical or Warning findings across any skill. "Game health: strong. No critical or warning findings across [N] reports."
- **Watch items**: No Critical, some Warnings. "Game health: stable. [N] watch items across [skills]."
- **Needs attention**: At least one Critical. "Game health: [N] critical issues need attention."
- **No reports yet**: "No analysis reports yet. Run /augury, /cabal, or /lore to start."

#### 5b: Top Findings (prioritized, cross-skill)

Display the top 5-7 findings from Step 4d ranking:

```
-- Top Findings --

1. [CRITICAL] Resource economy: stamina depletes in 2.5 rounds vs 3-4 round combat
   augury RE-1 + lore hoarding-incentive [corroborated]
   → /homebrew game-state/resources/stamina.yaml

2. [WARNING] Experience split: Optimizer excited, Newcomer confused at dose resolution
   cabal divergence (HIGH) + augury cognitive-load CL-2 [corroborated]
   → /homebrew game-state/mechanics/dose-resolution.yaml

3. [CONTRADICTION] Healing throughput: augury says balanced, cabal says trivializes combat
   augury RE-3 (Healthy) vs cabal Optimizer signal (Mastery reward)
   → /cabal --optimizer --veteran to investigate

4. [WARNING] Linear fighter / quadratic wizard scaling
   lore d20-scaling-002 [INTENT-CONFLICT]
   → /augury progression to quantify
```

Each finding shows: severity, description, source skills, synthesis tag, and a recommended next action.

If no reports exist yet, skip this section.

#### 5c: What's Working (strengths)

Surface positive signals — designers need to know what to protect:

```
-- Working Well --

- Core resolution: clean probability curve, no dead zones (augury: Healthy)
- First encounter beat: all archetypes engaged (cabal: no divergence)
- No catalogued anti-patterns in combat mechanics (lore: clean scan)
```

Draw from: Augury `[Healthy]` findings, Cabal `Cool moment` and `Mastery reward` signals with no divergence, Lore clean scans. Cap at 3-5 items.

If no positive signals exist in reports, skip this section. If no reports exist, skip.

#### 5d: Trajectory (if multiple reports exist)

If 2+ reports exist for any skill, show the trend:

```
-- Trajectory --

augury: 3 Critical → 1 Critical (across 2 reports, improved)
cabal:  2 HIGH divergences → 2 HIGH divergences (persisting)
lore:   4 findings → 2 findings (improving)
```

Compare finding counts by severity between earliest and most recent report per skill. Classify as `improving`, `stable`, `worsening`, or `persisting` (specific findings unchanged).

If only one report per skill exists, skip this section.

### Step 6: Display Tensions

1. Glob `grimoires/gygax/game-state/tensions/*.yaml`.
2. Read each tension: `name`, `health`, `health_notes`.
3. Display:

```
-- Tensions --
[name]: [health] — [brief health_notes]
```

Health indicators: `balanced`, `a-dominant`, `b-dominant`, `collapsed`.

If no tensions exist: "No tensions defined."

### Step 7: Display Intent Coverage

1. Count entities with `intent` field set vs total.
2. Display:

```
-- Intent Coverage --
N of M entities have intent set (X% coverage)
  Tensions: 3/3 (100%)
  Mechanics: 5/12 (42%)
```

If tensions lack intent: warn "Tensions without intent — run /homebrew --set-intent".

### Step 8: Active Branches and References

#### Scry Branches

1. Glob `grimoires/gygax/forks/*/delta.md` (exclude `.archived/`).
2. Display each active branch with summary from delta.md first line.
3. If none, skip silently.

#### Installed References

1. Glob `grimoires/gygax/references/*/metadata.yaml`.
2. Display name, tradition, version for each.
3. If none, skip silently.

#### Learned Heuristics

1. Glob `grimoires/gygax/learned-lore/*.yaml` (exclude `.promoted/`).
2. Display count grouped by category.
3. If none, skip silently.

### Step 9: Recommended Next Action

Based on the synthesis, suggest the single most impactful thing to do next:

- If Critical findings exist: "/homebrew [most-critical-entity] — this is the highest-priority fix."
- If contradictions exist: "/cabal [contradiction-entity] — theory and play disagree, need more data."
- If Warning findings exist but no Critical: "/augury [warning-entity] or /homebrew [warning-entity] — address watch items."
- If no findings but skills haven't been run: "Run /augury for balance analysis, /lore for pattern check, or /cabal for playtest."
- If all clear: "Design is in good shape. /scry to experiment with new ideas, or /homebrew to add mechanics."

```
-- Next Action --
/homebrew game-state/resources/stamina.yaml — stamina economy is the highest-priority fix (Critical, corroborated by augury + lore)
```

### Step 10: Display Loa Context (if available)

1. Check for active sprint context in `grimoires/loa/` or `.run/sprint-plan-state.json`.
2. If found, display active sprint name and Gygax-related tasks.
3. If not found, skip silently.

## Output Format

The full dashboard, top to bottom:

```
== Gygax Status ==

Game:      [name] ([tradition])
           [description]
Modified:  [last_modified_at]
Entities:  [total] total ([type]: [count], ...)
Graph:     [resolved] refs, [stubs] stubs, [orphaned] orphaned, [circular] circular
Design:    [compact parameter summary]

Game health: [one-line assessment]

-- Top Findings --
[prioritized, cross-skill, 5-7 items max]

-- Working Well --
[strengths from reports, 3-5 items max]

-- Trajectory --
[trend per skill, if multiple reports exist]

-- Tensions --
[name]: [health]

-- Intent Coverage --
[coverage summary]

-- Active Branches --
[branch summaries]

-- References --
[installed references]

-- Learned Heuristics --
[count by category]

-- Next Action --
[single most impactful recommendation]

-- Active Sprint --
[if Loa context exists]
```

Sections with no data are omitted silently (except Game health, which always shows even if "no reports yet").

## Boundaries

- Does NOT modify any game content or artifacts — strictly read-only
- Does NOT perform original analysis — synthesizes existing report findings
- Does NOT ingest new material
- Does NOT write any persistent artifacts — output is ephemeral
- Does NOT read full report contents beyond what's needed for finding extraction
- DOES read up to 3 most recent reports per skill for trajectory
- DOES cross-reference findings across skills
- DOES surface strengths alongside problems
- DOES recommend a specific next action

## Error Handling

| Error | Response |
|-------|----------|
| No game-state directory or index.yaml | "No game attuned. Run `/attune` to onboard a game system." |
| index.yaml exists but is malformed | Display what can be parsed; note "index.yaml may need regeneration via `/attune`" |
| Report files exist but are empty or malformed | Skip that report; do not include in synthesis |
| No reports exist for any skill | Show identity/entities/tensions; skip synthesis sections; show "No reports yet" health |
| Tension files reference missing dependencies | Ignore; display tension name and health only |
| Loa state files missing or unreadable | Skip Loa context silently |
