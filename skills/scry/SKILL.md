---
name: scry
description: Design experimentation through persistent forked game-state with inline analysis
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
---

# Scry

Explore design changes without risk by forking the game-state, applying a proposed change, running inline balance and playtest analysis against the fork, and producing a delta report comparing the fork to main. Multiple forks can exist simultaneously for side-by-side comparison. When a design direction proves out, commit it to main game-state; when it does not, discard it to the archive.

Scry exists because design iteration is expensive when every change goes straight into game-state. Designers need to ask "what if?" safely -- see the numbers, feel the play impact, compare alternatives -- before committing. Scry makes that exploration persistent, browsable, and grounded in the same analytical rigor as `/augury` and `/cabal`.

Every fork is a full copy of game-state (not an incremental delta). This means forks are self-contained, readable documents. Someone can open a fork directory and understand the entire design exploration without needing to reconstruct a chain of patches.

## Trigger

`/scry` with a quoted change description or a subcommand.

Examples:
- `/scry "what if DOSE threshold was 4?"` -- create a fork with this change
- `/scry "add stamina recovery in combat"` -- create another fork
- `/scry compare` -- side-by-side comparison of all active forks vs. main
- `/scry commit threshold-4` -- merge fork to main game-state
- `/scry discard combat-recovery` -- archive fork
- `/scry list` -- show active and archived branches

Also triggered by natural language:
- "what if"
- "try changing"
- "fork the game state"
- "explore a design branch"

## Workflow

### Step 1: Parse Invocation

Determine which subcommand the user is invoking:

| Pattern | Subcommand | Action |
|---------|------------|--------|
| `/scry "quoted change"` | **fork** | Create a new design branch |
| `/scry compare` | **compare** | Side-by-side analysis of all active forks vs. main |
| `/scry commit {branch-name}` | **commit** | Merge fork game-state to main |
| `/scry commit {branch-name} --no-analysis` | **force commit** | Merge without requiring analysis |
| `/scry discard {branch-name}` | **discard** | Archive the fork |
| `/scry list` | **list** | Show all active and archived branches |

If the pattern is ambiguous, ask the user to clarify.

---

### Subcommand: Fork (Create a Design Branch)

#### Step F1: Load Main Game-State

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If it does not, stop and tell the user: "No game attuned yet. Run `/attune` first to build your game-state."
2. Read `index.yaml` to get the full entity manifest: game name, tradition, entity counts, file list, and dependency graph summary.
3. Identify which entities the proposed change affects. Parse the user's quoted description to determine:
   - Which entity files will be modified
   - What the modification is (value change, new entity, removal, structural change)
   - Which entities depend on or are affected by the changed entities (traverse `depends_on` and `affects` in the index)

If the user's description is vague, ask targeted questions to establish exactly what changes. Do not guess.

#### Step F2: Generate Branch Name

Derive a short, kebab-case branch name from the change description. Examples:
- "what if DOSE threshold was 4?" -> `threshold-4`
- "add stamina recovery in combat" -> `combat-stamina-recovery`
- "remove dodge reaction" -> `no-dodge-reaction`

Check for conflicts: glob `grimoires/gygax/forks/*/` to see if the name already exists. If it does, tell the user: "A branch named '{name}' already exists. Choose a different name or discard the existing branch first with `/scry discard {name}`."

#### Step F3: Create Fork Directory and Copy Game-State

1. Create the fork directory structure:
   ```
   grimoires/gygax/forks/{branch-name}/
     game-state/        # Full copy of main game-state
     analysis/          # Will hold augury and cabal reports
   ```
2. Copy the ENTIRE contents of `grimoires/gygax/game-state/` into `grimoires/gygax/forks/{branch-name}/game-state/`. This is a full copy -- every file, every subdirectory. Use bash `cp -r` for the copy.
3. Verify the copy by checking that `forks/{branch-name}/game-state/index.yaml` exists and matches main.

#### Step F4: Apply Proposed Change to Fork

1. Modify the forked game-state files to reflect the proposed change. This may involve:
   - Changing values in existing YAML entity files
   - Creating new entity files
   - Removing entity files
   - Updating `depends_on` and `affects` arrays in related entities
2. Update the fork's `index.yaml` to reflect all changes:
   - Update entity counts if entities were added or removed
   - Update file list entries
   - Update `last_modified_at` to current timestamp
   - Set `last_modified_by: scry`
   - Regenerate `dependency_graph_summary` if the dependency structure changed
3. Validate every modified YAML file: required fields present, cross-references point to files that exist within the fork, tradition is valid.

Do NOT modify any files in `grimoires/gygax/game-state/` (the main game-state). All changes happen in the fork only.

#### Step F5: Inline Augury Analysis (Scoped)

Perform augury-style numerical analysis against the forked game-state, scoped to the changed entities and their dependents. This is inline analysis derived from `/augury` methodology -- it does not invoke the augury skill.

1. Identify the analysis scope: the changed entities plus every entity in their `depends_on` and `affects` graph within the fork.
2. Determine applicable analysis types based on what changed:

| What Changed | Analysis Types |
|-------------|---------------|
| Combat mechanic (attack, damage, defense) | Combat analysis: hit probability, DPR, TTK |
| Resource (pool, cost, recovery) | Resource economy: depletion rate, recovery rate, net pressure |
| Progression (levels, scaling) | Scaling analysis: metric curves at breakpoints |
| Pacing-relevant mechanic (triggers, timing) | Pacing analysis: trigger frequency, arc coverage |
| Stat or modifier | Combat + resource recomputation for all dependents |

3. Run the applicable calculations using the formulas from augury methodology:
   - **Hit probability (d20):** `clamp((21 - (AC - attack_bonus)) / 20, 0.05, 0.95)`
   - **DPR:** `hit_probability * average_damage * attacks_per_round`
   - **TTK:** `target_HP / DPR`
   - **Resource depletion:** `pool_max / consumption_per_round`
   - **Net pressure:** `consumption_per_cycle - recovery_per_cycle`
   - **PbtA probabilities:** 2d6+stat distribution (10+, 7-9, 6-)
   - **FitD probabilities:** best-of-Nd6 distribution (crit, 6, 4-5, 1-3)
   - Adapt methodology to the game's tradition. Do not force d20 math onto a PbtA game.

4. Compute each metric for BOTH the fork and main game-state so deltas can be calculated.

5. Write results to `grimoires/gygax/forks/{branch-name}/analysis/augury-report.md` using this format:

```markdown
# Augury Analysis: {branch-name}

**Date:** YYYY-MM-DD
**Game:** [game name]
**Tradition:** [tradition]
**Scope:** Changed entities and dependents
**Entities Analyzed:** [count]

## Changed Entities

[List each entity that was modified, created, or removed, with a one-line description of the change.]

## Numerical Analysis

[Tables of computed metrics -- only include sections for which data exists.]

### [Analysis Type]

| Metric | Main Value | Fork Value | Delta | Assessment |
|--------|-----------|------------|-------|------------|
| ...    | ...       | ...        | ...   | Healthy / Warning / Critical |

## Findings

| # | Severity | Finding | Values |
|---|----------|---------|--------|
| 1 | ...      | ...     | ...    |

## Methodology Notes

[Assumptions, data gaps, tradition adaptations.]
```

#### Step F6: Inline Cabal Analysis (Context-Aware)

Perform cabal-style archetype analysis against the forked game-state, with a context-aware panel based on what changed. This is inline analysis derived from `/cabal` methodology -- it does not invoke the cabal skill.

1. Select the archetype panel based on what changed:

| What Changed | Priority Archetypes | Rationale |
|-------------|-------------------|-----------|
| Combat mechanic | Optimizer, Rules Lawyer | Combat changes hit optimization and RAW edge cases hardest |
| Resource economy | Optimizer, Explorer | Resource changes affect efficiency and viable build variety |
| Narrative/social mechanic | Storyteller, Explorer | Narrative changes affect fiction alignment and design space |
| Progression/scaling | Optimizer, Explorer | Scaling changes affect build planning and option breadth |
| Core resolution | All four | Core changes affect everything |

Always run at least the Optimizer and one other archetype. For core system changes, run all four.

2. For each selected archetype, simulate their interaction with the CHANGED mechanics in the fork:

**Optimizer:** Does this change create a new dominant strategy? Does it invalidate an existing optimized approach? Does the resource efficiency shift?

**Explorer:** Does this change open or close design space? Are there new viable options, or did options disappear? Are there new edge case interactions?

**Storyteller:** Does this change improve or worsen fiction-mechanics alignment? Does optimal play still produce interesting narrative? Are there new feel-bad moments?

**Rules Lawyer:** Does this change introduce ambiguity? Are there undefined states? Do any two mechanics now contradict? Is the trigger language precise?

3. For each archetype, produce at least one finding. Severity levels: Critical, Major, Minor, Observation, Non-obvious.

4. Write results to `grimoires/gygax/forks/{branch-name}/analysis/cabal-report.md` using this format:

```markdown
# Cabal Analysis: {branch-name}

**Date:** YYYY-MM-DD
**Game:** [game name]
**Tradition:** [tradition]
**Scope:** Impact of proposed change on play experience
**Panel:** [which archetypes were run and why]

## Change Under Test

[One-paragraph description of what changed in this fork.]

## [Archetype Name]

### Approach
[1-2 sentences: what this archetype tried to do with the change.]

### Findings
[Each finding: severity, summary, description, evidence from forked game-state.]

[Repeat for each archetype in the panel.]

## Non-Obvious Findings

[Dedicated section for second-order effects and emergent dynamics that arise specifically from this change.]
```

#### Step F7: Generate Delta Report

Compare the fork's analysis results against main game-state to produce a unified delta report.

1. Gather:
   - Numerical deltas from the augury analysis (Step F5)
   - Experience deltas from the cabal analysis (Step F6)
   - Tension impacts: which design tensions shifted and in what direction
2. Write the delta report to `grimoires/gygax/forks/{branch-name}/delta.md`:

```markdown
# Delta Report: {branch-name}

**Date:** YYYY-MM-DD
**Game:** [game name]
**Proposed Change:** [one-line description]
**Branch:** {branch-name}
**Status:** Active

## Summary

[2-4 sentences: what changed, the most significant numerical impact, the most significant experiential impact, and an overall assessment.]

## Numerical Deltas

| Metric | Main | Fork | Delta | Severity |
|--------|------|------|-------|----------|
| ...    | ...  | ...  | ...   | ...      |

## Experience Deltas

| Archetype | Impact | Summary |
|-----------|--------|---------|
| Optimizer | Positive / Negative / Neutral | [one-line] |
| Explorer  | ... | ... |
| Storyteller | ... | ... |
| Rules Lawyer | ... | ... |

## Tension Impacts

| Tension | Main State | Fork State | Shift |
|---------|-----------|------------|-------|
| ...     | balanced  | tilted-a   | ...   |

## Key Findings

[Top 3-5 findings across both augury and cabal analysis, prioritized by severity.]

## Recommended Next Steps

[Specific, actionable recommendations. Examples:]
- `/scry commit {branch-name}` -- if the change is clearly beneficial
- `/scry discard {branch-name}` -- if the change causes more problems than it solves
- `/scry "alternative approach"` -- if a variant might work better
- `/homebrew [mechanic]` -- if a specific mechanic needs redesign before committing
- `/augury [scope]` -- if deeper numerical analysis is needed on a specific metric
- `/scry compare` -- if other forks exist and should be compared
```

3. Present the delta report to the user.

---

### Subcommand: Compare

Compare all active forks against main game-state and against each other.

#### Step C1: Load Active Forks

1. Glob `grimoires/gygax/forks/*/delta.md` to find all active forks with completed analysis.
2. If no active forks exist, tell the user: "No active forks to compare. Create one with `/scry \"your proposed change\"`."
3. If only one fork exists, note that comparison is most useful with multiple forks but proceed with a fork-vs-main comparison.
4. Read each fork's `delta.md`.

#### Step C2: Generate Cross-Branch Comparison

1. Collect all numerical metrics that appear in any fork's delta report.
2. Build a comparison table with main as the baseline:

```markdown
# Branch Comparison

**Date:** YYYY-MM-DD
**Game:** [game name]
**Active Forks:** [count]

## Metric Comparison

| Metric | Main | {branch-1} | {branch-2} | ... |
|--------|------|-------------|-------------|-----|
| [metric] | [value] | [value] (delta) | [value] (delta) | ... |

## Experience Comparison

| Archetype | Main | {branch-1} | {branch-2} | ... |
|-----------|------|-------------|-------------|-----|
| Optimizer | baseline | [impact] | [impact] | ... |
| Explorer  | baseline | [impact] | [impact] | ... |
| Storyteller | baseline | [impact] | [impact] | ... |
| Rules Lawyer | baseline | [impact] | [impact] | ... |

## Tension Comparison

| Tension | Main | {branch-1} | {branch-2} | ... |
|---------|------|-------------|-------------|-----|
| [tension] | [state] | [state] | [state] | ... |

## Assessment

[For each fork: 1-2 sentence summary of whether it improves the design and the primary tradeoff.]

## Recommendation

[Which fork (if any) should be committed, and why. If none are clearly better, suggest what to explore next.]
```

3. Present the comparison to the user.

---

### Subcommand: Commit

Merge a fork's game-state into main.

#### Step M1: Validate the Fork

1. Check that the branch exists: `grimoires/gygax/forks/{branch-name}/` must exist and not be under `.archived/`.
2. Check that analysis has been run: `forks/{branch-name}/analysis/augury-report.md` and `forks/{branch-name}/analysis/cabal-report.md` must exist. If they do not:
   - Default behavior: "Branch '{name}' has no analysis results yet. Run `/scry` against it first, or force commit with `/scry commit {name} --no-analysis`."
   - If `--no-analysis` flag is present, proceed without analysis.
3. Check for staleness: read main `game-state/index.yaml` and compare its `last_modified_at` against the fork's creation time (from the fork's `delta.md` date). If main has been modified since the fork was created:
   - Identify conflicting files: files that changed in BOTH main and the fork.
   - Tell the user: "Main game-state has changed since this branch was created. The conflicting files are: {list}. Re-fork from current main, or force commit to overwrite."
   - If the user confirms force commit, proceed. Otherwise, stop.

#### Step M2: Copy Fork Game-State to Main

1. Copy all files from `grimoires/gygax/forks/{branch-name}/game-state/` to `grimoires/gygax/game-state/`, overwriting existing files.
2. Verify the copy: read the updated `game-state/index.yaml` and confirm it reflects the fork's state.

#### Step M3: Write Changelog Entry

Write a changelog entry to `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-scry-commit-{branch-name}.yaml`:

```yaml
timestamp: "ISO-8601"
skill: scry
action: merged
summary: "Merged branch '{branch-name}' to main game-state"
rationale: "[Summary of augury and cabal findings that justified the commit]"
source: "scry branch comparison"
branch: "{branch-name}"
files_changed:
  - [list of files that differ between fork and original main]
affected_tensions:
  - [list of tensions that shifted, from delta report]
```

#### Step M4: Clean Up

1. Remove the fork directory: `grimoires/gygax/forks/{branch-name}/`. The fork's analysis and delta are preserved in the changelog rationale, and the fork's game-state is now main.
2. Inform the user: "Branch '{branch-name}' merged to main game-state. Changelog entry written. Fork directory removed."

---

### Subcommand: Discard

Archive a fork without merging.

#### Step D1: Validate the Fork

1. Check that the branch exists at `grimoires/gygax/forks/{branch-name}/`.
2. If the branch is already under `.archived/`, tell the user: "Branch '{name}' is already archived."
3. If the branch does not exist anywhere, tell the user: "No branch named '{name}' found. Run `/scry list` to see available branches."

#### Step D2: Move to Archive

1. Create `grimoires/gygax/forks/.archived/` if it does not exist.
2. Move the fork directory: `mv grimoires/gygax/forks/{branch-name}/ grimoires/gygax/forks/.archived/{branch-name}/`
3. No changelog entry is written (nothing changed in main game-state).
4. Inform the user: "Branch '{branch-name}' archived. It can still be browsed at `forks/.archived/{branch-name}/`."

---

### Subcommand: List

Show all active and archived branches.

#### Step L1: Enumerate Branches

1. Glob `grimoires/gygax/forks/*/delta.md` for active branches.
2. Glob `grimoires/gygax/forks/.archived/*/delta.md` for archived branches.
3. For each branch, read the first few lines of `delta.md` to extract: branch name, proposed change, date, and status.

#### Step L2: Present List

```markdown
# Scry Branches

## Active

| Branch | Proposed Change | Date | Has Analysis |
|--------|----------------|------|--------------|
| {name} | [one-line description] | YYYY-MM-DD | Yes / No |

## Archived

| Branch | Proposed Change | Date | Reason |
|--------|----------------|------|--------|
| {name} | [one-line description] | YYYY-MM-DD | Discarded / Superseded |

[If no branches exist in either category, say so.]
```

---

## Inline Analysis Methodology

Scry's inline analysis is derived from `/augury` and `/cabal` but scoped and adapted for fork comparison. Key differences from the full skills:

### Augury-Derived Analysis

- **Scope:** Only entities changed in the fork plus their immediate dependents. Not full-spectrum.
- **Computation:** Same formulas as augury (hit probability, DPR, TTK, resource depletion, scaling curves). See augury SKILL.md for the complete methodology reference.
- **Output:** Comparative tables (main vs. fork) rather than standalone balance reports.
- **Severity:** Assessed relative to the delta, not absolute. A metric that was already "Warning" in main and stays "Warning" in the fork is "Unchanged," not a new finding.

### Cabal-Derived Analysis

- **Panel selection:** Context-aware based on what changed, not always all four archetypes.
- **Scope:** Archetypes interact with the changed mechanics specifically, not the entire game.
- **Regression awareness:** Not applicable (forks are new). Regression tracking happens in full `/cabal` runs against main game-state.
- **Non-obvious findings:** Still required. At least one finding per fork run must surface something the designer likely did not anticipate about the proposed change.
- **Output:** Per-archetype findings with evidence from forked game-state, following the same finding format as cabal (severity, summary, description, evidence, recommendation).

## Boundaries

- Does NOT modify main game-state until the user explicitly runs `/scry commit` -- forks are isolated
- Does NOT invoke other skills (augury, cabal, homebrew, lore, attune) -- contains its own inline analysis logic derived from those skills
- Does NOT write production game code or final prose
- Does NOT make final creative decisions -- presents delta analysis, the designer decides whether to commit or discard
- Does NOT perform full-spectrum analysis -- scopes to changed entities and dependents for speed and focus
- Does NOT auto-commit or auto-discard -- every merge and archive is an explicit user action
- DOES create persistent, browsable fork directories that are fully self-contained
- DOES write presentable markdown throughout -- every artifact is human-readable
- DOES track which entities changed and their full dependency graph within the fork
- DOES handle any TTRPG tradition -- adapts analysis methodology to the game's tradition (d20, PbtA, FitD, OSR, freeform, custom)
- DOES support multiple simultaneous forks for side-by-side comparison
- DOES include "Recommended Next Steps" in every delta report for cross-skill chaining

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Forked game-state | `grimoires/gygax/forks/{branch}/game-state/` | YAML (full copy) |
| Augury analysis | `grimoires/gygax/forks/{branch}/analysis/augury-report.md` | Markdown with tables |
| Cabal analysis | `grimoires/gygax/forks/{branch}/analysis/cabal-report.md` | Markdown with tables |
| Delta report | `grimoires/gygax/forks/{branch}/delta.md` | Markdown |
| Changelog (on commit) | `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-scry-commit-{branch}.yaml` | YAML |

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Redirect to `/attune` |
| Branch name conflict | "A branch named '{name}' already exists. Choose a different name or discard the existing branch first with `/scry discard {name}`." | User renames or discards |
| Commit with no analysis | "Branch '{name}' has no analysis results yet. Run `/scry` against it first, or force commit with `/scry commit {name} --no-analysis`." | User runs analysis or force commits |
| Main game-state changed since fork (stale fork) | "Main game-state has changed since this branch was created. The conflicting files are: {list}. Re-fork from current main, or force commit to overwrite." | User re-forks or force commits |
| Discard already-archived branch | "Branch '{name}' is already archived." | No action needed |
| Branch not found | "No branch named '{name}' found. Run `/scry list` to see available branches." | User checks list |
| Game-state too sparse for meaningful analysis | "Game-state has {N} entities. Analysis works best with stats, resources, and core mechanics defined. Proceeding with what exists -- findings may be limited." | Partial analysis with caveats |
| Proposed change is ambiguous | Ask the user targeted questions to clarify exactly what should change in the fork. Do not guess. | Clarification loop |
| Too many active forks (more than 5) | "You have {N} active forks. Consider discarding or committing some before creating more. Active forks: {list}." | Advisory, not blocking |
