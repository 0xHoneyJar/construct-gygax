---
name: homebrew
description: Design and refine TTRPG mechanics with cross-system consistency checking
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
---

# Homebrew

Design new TTRPG mechanics or refine existing ones through structured iteration. This is the core design skill of Gygax. It reads the full game-state before doing anything, checks proposed mechanics against every system that could interact with them, flags contradictions automatically, tracks design tensions as named pairs, and writes confirmed designs to game-state with full changelog traceability.

This skill works for all TTRPG traditions (d20, PbtA, FitD, OSR, freeform, custom) and all mechanic types -- combat, social, exploration, downtime, progression, and narrative.

## Trigger

/homebrew

Also triggered by natural language:
- "design a mechanic"
- "what if I added"
- "how would this work"
- "refine this system"

## Workflow

### Step 1: Load Game-State

Before analyzing or proposing anything, load the current state of the game.

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If it does not, stop and tell the user: "No game attuned yet. Run `/attune` first to build your game-state."
2. Read `index.yaml` to get the full entity manifest: game name, tradition, entity counts, file list, and dependency graph summary.
3. From the user's mechanic description, identify which existing entities are likely to interact with the proposed mechanic. Use the `depends_on` and `affects` fields in the index to traverse the dependency graph.
4. Load those specific entity files. Do NOT load the entire game-state -- only files relevant to this design. Typical load: 5-15 files.
5. Also load any existing `tensions/` files, since every new mechanic has the potential to shift a design tension.

### Step 2: Analyze Proposed Mechanic

Parse the user's request into structured components. Whether the user gives a detailed specification or a vague idea ("I want something like a parry"), extract:

- **Intent**: What the mechanic is supposed to accomplish in play
- **Trigger**: When does it activate (action, reaction, passive, downtime, narrative trigger)
- **Cost**: What resources it consumes (if any)
- **Resolution**: How the outcome is determined (roll, spend, opposed, automatic)
- **Effect**: What happens on success, failure, partial success (tradition-dependent)
- **Interactions**: What existing systems it touches
- **Tradition fit**: Whether the resolution method matches the game's tradition

If the user's description is incomplete, ask targeted questions to fill gaps. Do not invent details the user did not specify -- ask.

### Step 3: Cross-System Consistency Check

This is the key differentiator of Gygax. Check the proposed mechanic against every loaded entity for contradictions, broken assumptions, and hidden interactions.

**Resource availability checks:**
- Does the mechanic cost a resource? Verify the resource exists in game-state.
- Does the resource regenerate in the context where the mechanic is used? (Example: "dodge costs stamina, but stamina only recovers on rest -- dodge becomes unusable after round 2 of any combat.")
- Does the resource pool size support the expected usage frequency? (Example: "this costs 3 from a pool of 5 -- the player gets one use per rest, is that intended?")
- Are there other mechanics competing for the same resource? Flag resource contention.

**Action economy checks:**
- Does the mechanic consume an action type (action, bonus action, reaction, free action, downtime action)? Verify that action type exists in the game's economy.
- Does it compete with existing mechanics for the same action slot? Flag if the new option is strictly better or strictly worse than an existing one in the same slot.
- For PbtA/FitD: does the move trigger overlap with an existing move? Would the fiction ever create a situation where both triggers apply simultaneously?

**Stat and modifier checks:**
- Does the mechanic reference a stat? Verify the stat exists.
- Does the resolution scale with level/tier? Check whether the math holds at multiple progression points (early, mid, late game).
- Are there modifier stacking issues? (Example: "this grants +2 to AC, but your system uses bounded accuracy -- at level 10, AC would exceed the expected ceiling.")

**Dependency integrity checks:**
- Does the mechanic depend on entities that exist?
- Would adding this mechanic break any `affects` chains in existing entities?
- Are there circular dependencies?

**Narrative coherence checks:**
- Does the mechanic make fiction-sense within the game's setting assumptions?
- Does it create situations that are mechanically optimal but narratively absurd?
- For narrative-first games (PbtA, FitD): does the mechanic support or undermine the conversation-driven flow?

### Step 4: Design Tension Analysis

Every mechanic participates in at least one design tension. Identify which tensions the proposed mechanic engages.

1. Check existing `tensions/` entities. Does this mechanic shift the balance of any existing tension? If so, describe how and assess whether the tension remains healthy.
2. Does this mechanic create a NEW tension that does not yet exist in game-state? If so, name it and describe both poles.
3. Common tension patterns to check for:
   - **Risk / Reward**: Does the mechanic offer proportional reward for the risk taken?
   - **Power / Cost**: Is the effect worth the resource expenditure?
   - **Agency / Randomness**: Does the player have meaningful choices, or is the outcome purely random?
   - **Simplicity / Depth**: Does the mechanic add decision-making depth without excessive complexity?
   - **Specialization / Versatility**: Does it make a character better at one thing at the cost of breadth?
   - **Offense / Defense**: Does it shift the balance toward dealing or preventing damage?
   - **Short-term / Long-term**: Does spending now vs. saving for later create interesting choices?
4. Assess tension health: `balanced`, `tilted-a`, `tilted-b`, or `collapsed`. A collapsed tension means one pole has been eliminated -- a design problem.

### Step 5: Present Findings as Questions

Gygax is opinionated but Socratic. Frame every finding as a question the designer should answer, not a directive they must follow.

**Format findings by severity:**

- **Contradiction** (the mechanic cannot work as described given existing game-state): "This costs stamina, but your stamina system has no in-combat recovery. After round 2, this mechanic becomes dead weight. Should stamina recover partially each round, or should the cost be a different resource?"
- **Tension shift** (the mechanic changes an existing design tension): "Adding this gives fighters a reliable defensive option, which shifts the survivability-vs-resource-pressure tension toward survivability. Is that the direction you want?"
- **Missing dependency** (the mechanic references something that does not exist yet): "This mechanic triggers on a 'reaction' -- but your game-state doesn't define a reaction economy yet. Should we design that first?"
- **Overlap** (the mechanic duplicates or obsoletes an existing one): "The existing Shield spell already occupies the 'spend resource to avoid damage' slot for casters. How does this dodge differ in the decision space?"
- **Observation** (a non-blocking design note): "This mechanic scales linearly with level. Most mechanics in your system scale with proficiency bonus instead. Is the different scaling curve intentional?"

Always present contradictions first, then tension shifts, then missing dependencies, then overlaps, then observations.

### Step 6: Iterate with User

After presenting findings, enter an iterative design loop:

1. Wait for the user to respond to findings. They may accept, reject, or modify.
2. For each change the user proposes, re-run the consistency check (Step 3) against the updated design. New changes can introduce new contradictions.
3. Continue iterating until the user confirms the design.
4. If the user says "looks good" or "write it", proceed to Step 7.
5. If the user wants to explore alternatives, present them as side-by-side comparisons with tradeoff analysis.

Do not rush the user to confirmation. Design iteration is the point.

### Step 7: Write to Game-State, Designs, and Changelog

Once the user confirms the design:

**7a. Write entity files to game-state:**
- Write new YAML files to the appropriate `grimoires/gygax/game-state/` subdirectory (e.g., `mechanics/`, `resources/`, `tensions/`).
- Update existing entity files if the new mechanic changes their `depends_on` or `affects` arrays.
- Follow the game-state schema exactly (see `skills/attune/resources/game-state-schema.md`).
- Set `created_by: homebrew` and `last_modified_by: homebrew` with current ISO-8601 timestamps.
- Validate every YAML file before writing: required fields present, cross-references point to files that exist (or are being created in the same batch), tradition is valid.

**7b. Update index.yaml:**
- Add new files to the `files:` list with their `id`, `depends_on`, and `affects`.
- Update `entity_count` totals.
- Update `last_modified_at`.
- Regenerate `dependency_graph_summary` (most_depended_on, orphaned, circular).

**7c. Write design document:**
- Write a human-readable design document to `grimoires/gygax/designs/YYYY-MM-DD-description.md`.
- Include: design intent, final specification, consistency check results, design tensions affected, rationale for key decisions, and alternatives considered.

**7d. Append to changelog:**
- Write a changelog entry to `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-homebrew-description.yaml`.
- Format:

```yaml
timestamp: "ISO-8601"
skill: homebrew
action: created|modified|deprecated
entity: type/entity-id.yaml
summary: "One-line description of change"
rationale: "Why this change was made"
source: "User request context"

before:
  # Previous values (for modifications only)
after:
  # New values

affected_tensions:
  - tensions/tension-id.yaml
```

## Consistency Check Rules

The following rules are checked in Step 3. Each rule has a severity.

| Rule | Severity | Example |
|------|----------|---------|
| Resource referenced but does not exist in game-state | Contradiction | "Costs mana, but no mana resource defined" |
| Resource does not regenerate in the mechanic's usage context | Contradiction | "Costs stamina in combat, stamina only recovers on rest" |
| Stat referenced but does not exist | Contradiction | "Roll + Agility, but no Agility stat defined" |
| Action type does not exist in game's economy | Missing dependency | "Uses reaction, but no reaction economy defined" |
| Mechanic is strictly better than existing option in same slot | Overlap | "New dodge is always better than existing Shield" |
| Mechanic is strictly worse than existing option | Overlap | "Why would anyone use this instead of Shield?" |
| Modifier would exceed system's expected ceiling | Tension shift | "+3 bonus in a bounded accuracy system" |
| Resource pool too small for expected usage frequency | Observation | "Pool of 4 with a cost of 2 means 2 uses per rest" |
| Scaling curve differs from system norm | Observation | "Linear scaling in a proficiency-bonus system" |
| Narratively incoherent with setting assumptions | Observation | "Teleportation in a low-magic setting" |
| Move trigger overlaps with existing move (PbtA/FitD) | Overlap | "Both 'Defy Danger' and this trigger on threat" |
| Circular dependency introduced | Contradiction | "A depends on B, B depends on A" |

## Design Document Format

Design documents written to `grimoires/gygax/designs/` follow this structure:

```markdown
# Design: [Mechanic Name]

**Date:** YYYY-MM-DD
**Tradition:** [tradition]
**Status:** Confirmed

## Intent

What this mechanic is meant to accomplish in play.

## Specification

Full mechanic description with trigger, cost, resolution, effect.

## Consistency Check Results

Findings from the cross-system analysis, organized by severity.

## Design Tensions

Which tensions this mechanic participates in and how it affects them.

## Alternatives Considered

Other approaches discussed during iteration and why they were not chosen.

## Rationale

Key design decisions and their justification.
```

## Boundaries

- Does NOT ingest or parse existing rulebooks (use `/attune` for that)
- Does NOT perform quantitative balance analysis with specific numbers (use `/augury` for that)
- Does NOT simulate player interactions or adversarial stress-testing (use `/cabal` for that)
- Does NOT apply tradition-specific heuristic libraries (use `/lore` for that)
- Does NOT write production game code or final prose -- Gygax reasons about mechanics, other tools build
- Does NOT make final creative decisions -- presents findings as questions, the designer decides
- DOES handle structural consistency, dependency checking, tension tracking, and narrative coherence
- DOES work for non-combat mechanics: social systems, exploration, downtime, crafting, faction play, narrative moves
- DOES support mid-design pivots -- the user can change direction at any point during iteration

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Entity files | `grimoires/gygax/game-state/{type}/{id}.yaml` | YAML (game-state schema) |
| Index update | `grimoires/gygax/game-state/index.yaml` | YAML |
| Design document | `grimoires/gygax/designs/YYYY-MM-DD-description.md` | Markdown |
| Changelog entry | `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-homebrew-description.yaml` | YAML |
