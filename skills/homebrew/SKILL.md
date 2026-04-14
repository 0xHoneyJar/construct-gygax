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

## Subcommands

### `/homebrew --set-intent {entity-path}`

Retroactive intent capture for an existing game-state entity. Use this when a mechanic or tension was created before intent capture was in place, or when you want to articulate intent separately from a design session.

This subcommand makes intent-only changes — no implementation fields are touched.

Intent is **two-axis**: mechanical intent (what the math should do — owned by Gygax) and experiential intent (how the mechanic should feel — owned by companion constructs like Arneson). Both axes live on the same entity. Gygax captures both; companion constructs read the experiential axis for voicing and scene shaping.

**Workflow:**

1. Load the entity at `{entity-path}` from game-state.
2. Show current intent if present: "Current mechanical intent: [existing summary] (set by [set_by] at [set_at])"
   Show current experiential intent if present: "Current experiential intent: tone=[tone], pacing=[pacing], stakes=[stakes]"
   If no intent exists: "No intent currently set for this entity."
3. Ask for the new intent:
   - **Mechanical intent** (what the math should do):
     - "What's the one-line design goal for this entity?" → `mechanical_intent.summary`
     - "Why this design? What problem does it solve?" → `mechanical_intent.rationale`
     - "How severe are failures?" → `mechanical_intent.severity` (minor / moderate / major / lethal)
     - "What does failure look like?" → `mechanical_intent.failure_mode` (complication_not_lethality / resource_loss / narrative_consequence / lethality)
     - "Is this intent non-negotiable?" → `mechanical_intent.non_negotiable`
   - **Experiential intent** (how it should feel — optional but encouraged):
     - "What emotional tone should this mechanic carry?" → `experiential_intent.tone` (desperate / heroic / tragic / absurd / mundane / uncanny / tender / cruel / comic)
     - "How should time feel during this mechanic?" → `experiential_intent.pacing` (rushed / steady / languid / punctuated)
     - "Whose world is being touched?" → `experiential_intent.stakes` (personal / communal / cosmic / professional / trivial)
     - "What register should the prose take?" → `experiential_intent.register` (formal / colloquial / archaic / technical / mythic / intimate)
     - Any additional shaping notes → `experiential_intent.notes`
4. Write the updated entity file with the new or replaced intent blocks. Set `set_by: homebrew`, `set_at: [current ISO-8601]`. All other fields remain unchanged.
5. Write a changelog entry to `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-homebrew-set-intent-{id}.yaml` recording the intent change:

```yaml
timestamp: "ISO-8601"
skill: homebrew
action: modified
entity: "{entity-path}"
summary: "Set intent for [entity name]"
rationale: "Retroactive intent capture via --set-intent"
source: "User request"

intent_change:
  before: null  # or previous intent object if one existed
  after:
    mechanical_intent:
      summary: "..."
      rationale: "..."
      severity: moderate
      failure_mode: complication_not_lethality
      set_by: homebrew
      set_at: "ISO-8601"
      non_negotiable: false
    experiential_intent:  # optional — may be null if designer declines
      tone: uncanny
      pacing: languid
      stakes: communal
      register: intimate
      notes: "..."
```

6. Confirm to the user: "Intent set for [entity name]. augury, cabal, lore, and scry will now read this intent when analyzing [entity path]. Companion constructs (e.g., Arneson) will read the experiential axis for voicing."

No design document is written for `--set-intent` — this is intent-only, not a design change.

**Backwards compatibility:** Entities with the old single-axis `intent:` block (summary + rationale + non_negotiable) are treated as `mechanical_intent` with no `experiential_intent`. The old shape continues to work; the new shape adds the experiential axis alongside it.

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

### Step 6.5: Intent Capture

Once the user confirms a design, capture intent before writing to game-state. Intent is how Gygax knows what IS the design versus what is a bug — it shapes how augury, cabal, and lore classify findings.

**1. For tensions being created: REQUIRED — prompt for intent.**

Ask: "What's the design goal for this tension? When should it be balanced vs tilted toward one pole?"

Tensions without stated intent are incomplete. Do not write a new tension entity to game-state without an intent field.

**2. For new mechanics with high potential impact: ENCOURAGED.**

High potential impact means any mechanic that: changes resource flow, scales across levels, or interacts with multiple systems (appears in `most_depended_on` in index.yaml, or affects 3+ entities).

Ask: "What's the intent behind this design? What problem does it solve?" → `mechanical_intent`
Then: "How should this mechanic *feel* during play? (tone, pacing, stakes)" → `experiential_intent` (optional)

This is not required — if the user declines, proceed without it. Document absence as `mechanical_intent: null` in the entity file.

**3. For existing entities being modified: ASK ABOUT INTENT PRESERVATION.**

If the entity being modified has an existing `mechanical_intent` field (or legacy `intent` field), show it and ask: "This change modifies [entity]. Does it preserve the original intent: '[existing summary]'? Or does it shift the intent?"

- If shift: update the `mechanical_intent` field with new rationale. Capture who shifted it and when. Also ask if the experiential intent should shift.
- If preserve: no change to intent fields. Only the implementation fields change.

If the entity has no existing intent, treat it as a new mechanic and apply rule 2 above.

**4. Optional: ask about non-negotiability for critical mechanics.**

For mechanics that appear to be core to the game's identity (e.g., a central resolution mechanic, the primary tension), ask: "Is this intent non-negotiable? If yes, future analysis findings that conflict with this intent will be suppressed, not just downgraded."

Default is `non_negotiable: false`. Only set true on explicit designer confirmation.

**Capture intent in this YAML shape (two-axis):**

```yaml
mechanical_intent:
  summary: "one-line goal — what the math should do"
  rationale: "why this design"
  severity: moderate          # minor / moderate / major / lethal
  failure_mode: complication_not_lethality
  set_by: homebrew
  set_at: "ISO-8601"
  non_negotiable: false
experiential_intent:          # optional — null if designer declines
  tone: uncanny               # desperate / heroic / tragic / absurd / mundane / uncanny / tender / cruel / comic
  pacing: languid             # rushed / steady / languid / punctuated
  stakes: communal            # personal / communal / cosmic / professional / trivial
  register: intimate          # formal / colloquial / archaic / technical / mythic / intimate
  notes: "free-text shaping context for companion constructs"
```

**Backwards compatibility:** The old single-axis `intent:` shape (summary + rationale + non_negotiable) is treated as `mechanical_intent` with no `experiential_intent`. Existing entities do not need migration — they work as-is. The new shape adds the experiential axis alongside the mechanical one.

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
- If intent was captured in Step 6.5, include a **Design Intent** section immediately after the title block (before Specification). If `non_negotiable` is true, include the suppression note.

Design Intent section format:

```markdown
## Design Intent

**Summary:** [intent.summary]
**Rationale:** [intent.rationale]
**Non-negotiable:** [true/false]

[If non-negotiable: Findings that conflict with this intent will be suppressed in future analysis, not just downgraded.]
```

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

intent_change:  # Only if intent was set or modified
  before: null  # null for new entities; previous intent object for modifications
  after:        # New intent object as captured in Step 6.5
    summary: "one-line goal"
    rationale: "why this design"
    set_by: homebrew
    set_at: "ISO-8601"
    non_negotiable: false
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
| Proposed mechanic conflicts with existing tension's intent | Tension shift | "Adding a reliable defensive option conflicts with tensions/survivability-vs-resources.yaml intent: 'defense should always feel costly'" |

## Design Document Format

Design documents written to `grimoires/gygax/designs/` follow this structure:

```markdown
# Design: [Mechanic Name]

**Date:** YYYY-MM-DD
**Tradition:** [tradition]
**Status:** Confirmed

## Design Intent

**Summary:** [intent.summary]
**Rationale:** [intent.rationale]
**Non-negotiable:** [true/false]

[If non-negotiable: Findings that conflict with this intent will be suppressed in future analysis, not just downgraded.]

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

If intent was not captured (user declined or entity type does not warrant it), omit the Design Intent section entirely.

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
- DOES capture intent on new designs and tension modifications (Step 6.5)
- DOES ask about intent preservation when modifying existing entities (Step 6.5)

## Cross-Skill Chaining

After confirming a design, the skill suggests validation steps:

```
## Recommended Next Steps

Design confirmed. To validate:

1. `/augury {entity path}` — check the numerical balance of the new mechanic
2. `/cabal --optimizer --rules-lawyer {entity path}` — stress-test for exploits and ambiguities
3. `/lore {scope}` — check against known tradition anti-patterns
4. `/scry "{alternative approach}"` — explore a design branch if you want to compare alternatives
```

Each recommendation includes the exact invocation command tied to the specific entity just designed.

**Intent and cross-skill consistency:** As of v3, augury, cabal, lore, and scry all read the `intent` field from entity files before classifying findings. Intent is how you tell Gygax what IS the design versus what is a bug. A deliberately asymmetric mechanic with intent stated will surface as an Observation ("working as designed"), not a Warning. Without intent, every finding is classified purely on structure and math.

Tensions should always have intent set — a tension without intent is incomplete. Use `/homebrew --set-intent {entity-path}` to add intent retroactively to any entity.

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Entity files | `grimoires/gygax/game-state/{type}/{id}.yaml` | YAML (game-state schema) |
| Index update | `grimoires/gygax/game-state/index.yaml` | YAML |
| Design document | `grimoires/gygax/designs/YYYY-MM-DD-description.md` | Markdown |
| Changelog entry | `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-homebrew-description.yaml` | YAML |
