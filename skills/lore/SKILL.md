---
name: lore
description: Surface TTRPG design heuristics, patterns, and anti-patterns
model_tier: sonnet
effort: medium
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash
---

# Lore

Surface TTRPG design wisdom -- heuristics, common patterns, known anti-patterns, and lessons from published game systems. Lore reads your game-state, identifies which design tradition it belongs to, loads curated heuristic libraries for that tradition, and pattern-matches your design against known failure modes. It tells you what is wrong AND why it matters.

Lore is opinionated. These are not suggestions -- they are distilled failures and successes from decades of published tabletop design. When Lore flags something, it is because the pattern has a track record. You may override the wisdom, but you should know the history before you do.

Lore is strictly read-only and inline. It never modifies game-state. It never writes to grimoire directories. All output is presented directly in the conversation.

## Trigger

`/lore` with optional focus argument.

Examples:
- `/lore` -- full heuristic scan of the entire game-state
- `/lore combat` -- scan combat-related heuristics only
- `/lore resources` -- scan resource economy heuristics only
- `/lore progression` -- scan advancement and scaling heuristics only
- `/lore pacing` -- scan pacing and tempo heuristics only
- `/lore social` -- scan social mechanic heuristics only
- `/lore mechanics/dodge-reaction.yaml` -- scan heuristics relevant to a specific entity

## Workflow

### Step 1: Load Game-State and Determine Tradition

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If it does not, stop and tell the user: "No game attuned yet. Run `/attune` first to build your game-state."
2. Read `index.yaml` to get: game name, tradition, entity counts, file list, and dependency graph summary.
3. Determine the primary tradition. If `tradition` is `custom`, read the full game-state to identify which established traditions it borrows from most heavily -- load heuristics for all applicable traditions.
4. Determine the scan scope from the user's invocation:
   - **No argument**: full scan across all heuristic categories.
   - **Category keyword** (`combat`, `resources`, `progression`, `pacing`, `social`, `mechanics`): filter heuristics to matching categories.
   - **Specific entity path**: load that entity and its dependency graph, filter heuristics to categories relevant to the entity's type.

### Step 2: Load Heuristic Resource Files

1. Based on the tradition(s) identified in Step 1, load the corresponding YAML file(s) from `skills/lore/resources/`:
   - `d20.yaml` for d20 tradition
   - `pbta.yaml` for PbtA tradition
   - `fitd.yaml` for FitD tradition
   - `osr.yaml` for OSR tradition
   - For `freeform`: load PbtA heuristics (closest applicable) and note the adaptation.
   - For `custom`: load all tradition files whose heuristics are relevant based on the mechanics present in game-state. For truly novel games (journaling, map-drawing, lyric, etc.), many heuristics will not apply — that is expected. The value is in the ones that DO match. If fewer than 3 heuristics match, say so honestly: "This game is novel enough that most tradition-specific heuristics don't apply. Here's what I can offer from structural analysis instead." Then focus on universal patterns: decision space quality, loop completeness, tension health, pacing.
2. Parse the heuristic entries. Each heuristic has: `id`, `name`, `category`, `description`, `detection`, `severity`, and `tradition_specific`.
3. If a scope filter was specified, discard heuristics whose `category` does not match the requested scope.

### Step 3: Load Relevant Game-State Entities

1. For a full scan: load all game-state entity files.
2. For a scoped scan: load entities matching the scope:
   - `combat` scope: load mechanics with combat-related tags, resources consumed by combat mechanics, stats used by attack/defense.
   - `resources` scope: load all resource entities plus mechanics that consume or recover them.
   - `progression` scope: load all progression entities plus resources with `max_by_level`.
   - `pacing` scope: load resources (for depletion tempo), mechanics (for trigger frequency), tensions.
   - `social` scope: load mechanics with social tags, stats used by social mechanics.
   - Specific entity: load the named entity plus everything in its `depends_on` and `affects` graph.
3. Build a working model of the game-state: what stats exist, what resources exist, how they connect, what the progression curve looks like, what tensions are declared.

### Step 4: Pattern-Match Heuristics Against Game-State

For each heuristic in the loaded set:

1. Read the `detection` field. This describes what to look for in the game-state.
2. Examine the loaded game-state entities for evidence of the pattern.
3. Classify the match:
   - **Match**: the game-state clearly exhibits this pattern. Provide specific entity references.
   - **Partial match**: the game-state shows some indicators but not all. Note what is present and what is ambiguous.
   - **No match**: the game-state does not exhibit this pattern. Skip silently -- do not report clean results for every heuristic.
   - **Insufficient data**: the game-state lacks the entities needed to evaluate this heuristic. Note only if the missing data is significant.
4. For `tradition_specific: false` heuristics, evaluate even if they come from a different tradition file than the game's primary tradition. Cross-tradition wisdom applies everywhere.
5. For each match or partial match, record:
   - The heuristic ID and name
   - The severity (from the heuristic definition)
   - Which game-state entities exhibit the pattern (with file paths)
   - A brief explanation of why this matters for THIS specific game

### Step 5: Present Findings Organized by Severity

Present all findings inline. Organize by severity, then by category within each severity level.

#### Output Format

```
## Lore Scan: [Game Name] ([Tradition])
Scope: [full | category | entity path]
Heuristics evaluated: [N] from [tradition file(s)]
Matches found: [N]

### Critical

**[Heuristic Name]** (category: [category])
Pattern: [What the anti-pattern is, from the heuristic description]
Found in: [specific game-state entity paths]
Analysis: [Why this matters for this specific game. Be concrete. Reference the entity values.]
Consider: [What the designer should think about. Not a prescription -- a prompt for reflection.]

### Warning

[Same format per finding]

### Info

[Same format per finding]

### No Issues Detected

[If the scan found zero matches, say so explicitly. Do not fabricate findings.]
"Lore scan complete. No known anti-patterns detected in the [scoped] game-state.
This does not mean the design is perfect -- it means it does not match any catalogued
failure modes for the [tradition] tradition. Consider `/augury` for quantitative
validation or `/cabal` for adversarial stress testing."
```

#### Presentation Rules

1. **Critical findings first.** Always. A designer must see blockers before warnings.
2. **Be specific.** "Your healing surge recovers 1d10+5 on a short rest but your expected incoming DPR is 15/round for 4 rounds -- the heal does not create meaningful recovery tension" is useful. "Healing might be too low" is not.
3. **Cite the game-state.** Every finding must reference specific entity file paths and values. The designer should be able to trace your reasoning.
4. **Explain the history.** Briefly note why this is a known pattern. "This is the linear fighter / quadratic wizard problem identified in 3e-era d20 design" gives the finding weight and searchability.
5. **Do not prescribe fixes.** Lore identifies patterns and explains why they matter. It does not design solutions. For fixes, direct to `/homebrew`. For quantitative validation, direct to `/augury`.
6. **Partial matches get honesty.** If you see indicators but cannot confirm, say "Partial match -- [what I see] suggests [pattern] but the game-state lacks [data] to confirm. Run `/attune` to add [missing data] or `/augury` to measure."
7. **Cross-tradition findings are welcome.** If a d20 game exhibits a pattern catalogued under FitD wisdom, report it. Good design knowledge is not tradition-locked.
8. **Do not pad.** If only 2 heuristics match, report 2. Do not stretch partial matches into findings to fill space. A clean scan is a valid and valuable result.
9. After presenting findings inline, write the same formatted output to `grimoires/gygax/lore-reports/YYYY-MM-DD-scope-description.md`. The persisted report should be readable standalone without conversation context.

### Step 6: Offer Next Steps

Based on findings, suggest specific next actions:

- If critical findings exist: "These should be addressed before further development. Try `/homebrew [entity]` to redesign, or `/augury [entity]` to quantify the severity."
- If only warnings: "These are worth investigating but may be intentional. `/augury` can measure whether the numbers actually break, or `/cabal` can test whether players exploit the pattern."
- If only info: "Nothing alarming. These are patterns to keep in mind as the design evolves. `/cabal` would tell you whether these matter in practice."
- If no matches: "Clean scan. Your design avoids catalogued failure modes. `/augury` for math validation and `/cabal` for adversarial testing are your next best steps."

### Step 7: Cross-Skill Chaining

Every lore report ends with a "Recommended Next Steps" section:

- Critical findings: "Address with `/homebrew {entity}`. For quantitative severity, run `/augury {entity}`."
- Warning findings: "Validate with `/cabal {entity}` to test whether players exploit this pattern."
- Info findings: "Monitor during next `/cabal` run. No immediate action needed."
- No matches: "Clean scan. Consider `/augury` for math validation and `/cabal` for adversarial testing."

Each recommendation includes the exact invocation command, not just the skill name.

## Tradition-Specific Scan Behavior

Different traditions have different areas of concern. The scan adapts:

| Tradition | High-Priority Categories | Lower-Priority Categories |
|-----------|------------------------|--------------------------|
| d20 | math, progression, resources, mechanics | social, pacing |
| PbtA | mechanics, pacing, social | math, progression |
| FitD | resources, pacing, mechanics | math, progression |
| OSR | resources, pacing, mechanics | progression, social |

This does not mean low-priority categories are skipped -- they are still scanned. But findings in high-priority categories are given extra analytical depth.

## Boundaries

- Does NOT modify game-state files -- strictly read-only (use `/homebrew` to act on findings)
- Does NOT perform quantitative balance analysis (use `/augury` for numbers)
- Does NOT simulate play (use `/cabal` for adversarial testing)
- Does NOT ingest source material (use `/attune` for that)
- Does NOT prescribe fixes -- identifies patterns and explains why they matter
- Writes scan results to `grimoires/gygax/lore-reports/` as presentable markdown. Also displayed inline.
- DOES load and apply curated heuristic libraries from `skills/lore/resources/`
- DOES cross-reference heuristics across traditions when applicable
- DOES adapt scan depth based on the game's tradition
- DOES report clean scans as a valid result (no finding fabrication)
- Does NOT edit files in `.claude/` (System Zone)

## Output

Output is both inline in the conversation AND persisted to `grimoires/gygax/lore-reports/YYYY-MM-DD-scope-description.md`.

| Artifact | Destination | Format |
|----------|-------------|--------|
| Heuristic scan results | Conversation (inline) + `grimoires/gygax/lore-reports/` | Structured markdown per finding |

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Direct to `/attune` |
| Tradition is unrecognized | "The tradition `[value]` in your index.yaml is not one I have heuristic libraries for. I can scan using the closest matching tradition -- which of d20, PbtA, FitD, or OSR is closest?" | Ask user to clarify |
| Scope keyword matches no categories | "I don't have a `[keyword]` category in my heuristic libraries. Available categories: math, progression, resources, pacing, mechanics, social. Or specify an entity path." | Offer alternatives |
| Game-state too sparse to evaluate most heuristics | "Your game-state has [N] entities. Most heuristics need at least stats, resources, and core mechanics to evaluate. Run `/attune` to flesh out the game-state." | Direct to `/attune` |
| Specific entity path not found | "I can't find `[path]` in game-state. Here's what exists: [list from index]. Did you mean one of these?" | Offer alternatives |
| Custom tradition with no clear lineage | Load all four heuristic files. Filter to `tradition_specific: false` heuristics plus any whose detection patterns match observable game-state structures. Note: "Scanning cross-tradition heuristics since this is a custom system." | Broadest possible scan |
