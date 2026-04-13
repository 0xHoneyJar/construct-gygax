---
name: gygax-status
description: Display current Gygax construct status and game state overview
model_tier: haiku
effort: small
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash
---

# Gygax Status

Lightweight status dashboard for the Gygax construct. Shows the current state of the attuned game system at a glance: what exists, what's healthy, and what's been analyzed recently. This is the "where am I?" command -- fast orientation, no analysis, no modifications.

## Trigger

`/gygax`

No arguments. Always produces the same dashboard for the current project state.

## Workflow

### Step 1: Check Game-State Existence

1. Check if `grimoires/gygax/game-state/index.yaml` exists.
2. If it does NOT exist, display a short message and stop:
   ```
   No game attuned. Run /attune to onboard a TTRPG system.
   ```
   Do not proceed further. There is nothing to report.

### Step 2: Load Index

1. Read `grimoires/gygax/game-state/index.yaml`.
2. Extract: `game`, `tradition`, `description`, `last_modified_at`, and `entity_count` (stats, resources, mechanics, progression, entities, tensions).

### Step 3: Display Game Identity

Present the game name, tradition, description, and last modified timestamp. This is the header of the dashboard.

### Step 4: Display Entity Counts

Show entity counts from the index as a compact summary. Include the total across all types. Example format:

```
Entities: 24 total (stats: 6, resources: 4, mechanics: 8, progression: 2, entities: 3, tensions: 1)
```

Omit any entity type with a count of zero to keep it concise.

### Step 5: Display Active Tensions

1. Glob for `grimoires/gygax/game-state/tensions/*.yaml`.
2. If tension files exist, read each one and extract: `name`, `health`, and `health_notes`.
3. Display each tension with its health status. Use plain text indicators:
   - `balanced` -- healthy, working as designed
   - `a-dominant` or `b-dominant` -- one pole is winning, may need attention
   - `collapsed` -- tension has broken down, needs intervention
4. If no tensions exist, display: "No tensions defined."

### Step 6: Display Intent Coverage

1. Load index.yaml, count entities by type.
2. For each entity file, check for intent field presence.
3. Calculate coverage:
   - Tensions should be 100% (required)
   - Mechanics coverage reflects design investment
4. Display:
   ```
   -- Intent Coverage --
   N of M entities have intent set (X% coverage)
     Tensions: 3/3 (100% ✓)
     Mechanics: 5/12 (42%)
     Progression: 0/2
   ```
5. If coverage is 0% for tensions: warn "Tensions without intent are incomplete — run /homebrew --set-intent to capture"
6. If no entities exist, skip section silently.

### Step 7: Display Active Scry Branches

1. Glob for `grimoires/gygax/forks/*/delta.md` (exclude `.archived/`).
2. If fork directories exist, read each `delta.md` first line for the branch summary.
3. Display each active branch with its summary.
4. If no active forks, skip this section silently.

### Step 7.5: Display Installed References

1. Glob `grimoires/gygax/references/*/metadata.yaml`.
2. If references exist, read each metadata.yaml for name, tradition, version.
3. Display:
   ```
   -- References --
   5e-srd: D&D 5e SRD Core (d20, v5.1)
   pbta-baseline: Apocalypse World Core (pbta, v2)
   ```
4. If no references, skip section silently (don't show "none").

### Step 8: Display Latest Balance Report

1. Glob for `grimoires/gygax/balance-reports/*.md`.
2. If reports exist, identify the most recent by filename (filenames are date-prefixed: `YYYY-MM-DD-*`).
3. Read the first 30 lines of the most recent report to extract the title (first `#` heading), date, scope, and the Executive Summary section.
4. Display: report title, date, and a 1-2 sentence summary drawn from the Executive Summary.
5. If no balance reports exist, display: "No balance reports yet. Run /augury to analyze."

### Step 9: Display Latest Playtest Report

1. Glob for `grimoires/gygax/playtest-reports/*.md`.
2. If reports exist, identify the most recent by filename (date-prefixed).
3. Read the first 30 lines of the most recent report to extract the title, date, and key findings or summary.
4. Display: report title, date, and a 1-2 sentence summary.
5. If no playtest reports exist, display: "No playtest reports yet. Run /cabal to simulate play."

### Step 10: Display Latest Lore Report

1. Glob for `grimoires/gygax/lore-reports/*.md`.
2. If reports exist, identify the most recent by filename (date-prefixed).
3. Read the first 30 lines for title, date, and summary.
4. Display: report title, date, and 1-2 sentence summary.
5. If no lore reports exist, display: "No lore reports yet. Run /lore for heuristic scan."

### Step 11: Display Learned Lore Count

1. Glob `grimoires/gygax/learned-lore/*.yaml` (exclude `.promoted/`).
2. Count entries; group by category.
3. Display:
   ```
   -- Learned Heuristics --
   12 patterns captured (mechanics: 5, pacing: 3, resources: 4)
   Run /lore promote to graduate mature patterns to curated library.
   ```
4. If no learned lore, skip section silently.

### Step 12: Display Latest Delve Report

1. Glob `grimoires/gygax/delve-reports/*.md`.
2. If reports exist, identify the most recent (date-prefixed filename).
3. Read first 30 lines for title, date, dungeon, summary.
4. Display: report title, date, 1-2 sentence summary.
5. If no delve reports, display: "No delve reports yet. Run /delve to analyze dungeons."

### Step 13: Display Loa Context (if available)

1. Check if an active sprint context exists by looking for sprint plan files in `grimoires/loa/` or `.run/sprint-plan-state.json`.
2. If Loa sprint context is found, display: the active sprint name and any tasks related to the Gygax construct.
3. If no Loa context is found, skip this section silently. Do not display a "no Loa context" message -- this section only appears when relevant.

## Output Format

The dashboard is displayed directly to the user as a concise, scannable summary. No files are written. The format should resemble:

```
== Gygax Status ==

Game:      [name] ([tradition])
           [description]
Modified:  [last_modified_at]

Entities:  [total] total ([type]: [count], ...)

-- Tensions --
[name]: [health] -- [brief health_notes excerpt]

-- Intent Coverage --
N of M entities have intent set ([X]% coverage)

-- Active Branches --
[branch-name]: [summary from delta.md]

-- References --
[slug]: [name] ([tradition])

-- Learned Heuristics --
[count] patterns captured

-- Latest Balance Report --
[title] ([date])
[summary]

-- Latest Playtest Report --
[title] ([date])
[summary]

-- Latest Lore Report --
[title] ([date])
[summary]

-- Latest Delve Report --
[title] ([date])
[summary]

-- Active Sprint --
[sprint name]: [relevant task summary]
```

Sections with no data are either omitted entirely (Loa context) or show a one-line suggestion of which skill to run (balance/playtest reports, tensions).

## Boundaries

- Does NOT modify any game content or artifacts -- strictly read-only
- Does NOT perform analysis, design work, or balance calculations
- Does NOT ingest new material
- Does NOT read full report contents -- only extracts summaries from headers and first sections
- Does NOT edit files in `.claude/` (System Zone)
- Does NOT write any persistent artifacts -- output is ephemeral, displayed to the user only
- Keeps execution fast: minimal file reads, no computation, no iteration over large file sets
- DOES show references, learned lore counts, delve reports, and intent coverage

## Error Handling

| Error | Response |
|-------|----------|
| No game-state directory or index.yaml | "No game attuned. Run `/attune` to onboard a TTRPG system." |
| index.yaml exists but is malformed | Display what can be parsed; note "index.yaml may need regeneration via `/attune`" |
| Tension files reference missing dependencies | Ignore dependency issues; display tension name and health only |
| Balance/playtest report file exists but is empty | Skip that section; do not display an empty report summary |
| Loa state files missing or unreadable | Skip the Loa context section silently |
