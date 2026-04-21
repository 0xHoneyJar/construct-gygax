---
name: attune
description: Onboard and ingest a game system, rulebook, or game reference into Gygax
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash, WebFetch
---

# Attune

Onboard and ingest a game system, rulebook, or game reference into the Gygax construct. This skill reads source material -- markdown documents, plain text, URLs, repositories, or conversational input -- extracts core mechanics, and produces structured game-state YAML artifacts that all other Gygax skills depend on.

Attune is the gateway to everything Gygax does. Without game-state, no other skill can function. The user should NEVER need to manually author YAML. Attune does all the extraction, structuring, cross-referencing, and validation.

## Trigger

`/attune` with optional source argument or flag.

Examples:
- `/attune docs/rulebook.md` -- ingest a markdown document
- `/attune src/rules/` -- ingest a directory of files
- `/attune https://example.com/srd` -- ingest from a URL
- `/attune` -- no arguments, start a guided interview for a new game
- `/attune --reference 5e-srd` -- install a bundled reference system (no interview, no ingestion)

## Workflow

### Phase 0: Environment Check

1. Load the Gygax persona from `identity/persona.yaml`. Adopt the voice: collaborative-authoritative, Socratic, systems-first.
2. Check if `grimoires/gygax/game-state/index.yaml` exists.
   - If YES: this is a **re-attune** or **additive attune**. Load the existing index. Note what entity types already exist and their counts. You will merge, not overwrite.
   - If NO: this is a **first attune**. You will create the full directory structure.
3. Ensure the grimoire directory structure exists. If any directories are missing, create them:
   ```
   grimoires/gygax/
     game-state/
       stats/
       resources/
       mechanics/
       progression/
       entities/
       tensions/
     designs/
     balance-reports/
     playtest-reports/
     changelog/
   ```

### Phase 1: Input Classification

Examine the user's invocation to determine the input mode.

| Input | Mode | Strategy |
|-------|------|----------|
| `--reference {name}` flag | **Reference Installation** | Install a pre-attuned bundled reference system — skip to Phase 1.5, then stop |
| File path to markdown/text | **Document Ingestion** | Read the file, extract game content, then interview to fill gaps |
| Directory path | **Repo Ingestion** | Glob for relevant files (.md, .txt, .yaml), read them, extract, interview to fill gaps |
| URL | **URL Ingestion** | Fetch the URL content with WebFetch, extract, interview to fill gaps |
| No argument provided | **Guided Interview** | Build game-state entirely through conversation |
| Existing game-state + new source | **Additive Ingestion** | Merge new content into existing game-state without destroying what exists |

**Key principle:** For existing games with source material, ingestion comes first and interview fills gaps. For new games being designed from scratch, interview drives the process and builds game-state incrementally.

### Phase 1.5: Reference Installation Mode (--reference flag only)

This is a SHORT workflow. When the user invokes `/attune --reference {name}`, do NOT run a guided interview or ingestion. Execute the following steps and then stop.

**Available reference slugs:** `5e-srd`, `pbta-baseline`, `cepheus-core`

1. **Check for the bundle.** Look for `skills/attune/resources/references/{name}/` in the construct directory.
   - If the directory does not exist, the slug is not available. Report: "Reference '{name}' not available. Bundled references: 5e-srd, pbta-baseline, cepheus-core." Stop.
2. **Check if already installed.** Look for `grimoires/gygax/references/{name}/`.
   - If it exists: "Reference '{name}' already installed at grimoires/gygax/references/{name}/. Reinstall? [y/N]"
   - Wait for user confirmation before proceeding. If the user declines, stop.
3. **Copy the bundle.** Copy the bundled game-state from `skills/attune/resources/references/{name}/game-state/` to `grimoires/gygax/references/{name}/game-state/`.
4. **Copy metadata.** Copy `skills/attune/resources/references/{name}/metadata.yaml` to `grimoires/gygax/references/{name}/metadata.yaml`.
5. **Validate.** Check that all copied YAML files conform to the schema defined in `skills/attune/resources/game-state-schema.md`. Fix any issues silently; surface only those that require user input.
6. **Report success.** "Reference system '{name}' installed. Use `/augury compare --against {name}` to cross-reference."
7. **Write changelog entry** to `grimoires/gygax/changelog/` using the standard Phase 7 format, with `action: created` and `source: reference-bundle`.

**Do not proceed to Phase 2 or beyond.** Reference installation is complete after step 7.

### Phase 2: Source Ingestion (if source provided)

Read the source material thoroughly. Do NOT skim. Read every file, every section.

1. **Read the source.** Use Read for files, Glob+Read for directories, WebFetch for URLs.
2. **Identify the TTRPG tradition.** Classify into: `d20`, `pbta`, `fitd`, `osr`, `cepheus`, `freeform`, or `custom`. This determines how you interpret the source and what schema fields are relevant.
   - **d20**: Ability scores, AC, HP, attack rolls, saving throws, spell slots, CR, levels (D&D, Pathfinder, 13th Age)
   - **pbta**: Stats (-1 to +3), moves (2d6+stat, 10+/7-9/6-), playbooks, harm/conditions (Dungeon World, Apocalypse World, Monsterhearts)
   - **fitd**: Action ratings, position/effect, stress/trauma, clocks, crew sheets (Blades in the Dark, Scum & Villainy)
   - **osr**: Minimal stats, high lethality, procedures over rules, reaction tables, resource depletion (Cairn, Knave, Into the Odd)
   - **cepheus**: 2d6+mod vs target 8+, Effect-based degrees of success (Effect = roll - 8, continuous gradient not fixed tiers), lifepath character creation with career terms, 6 characteristics (Str/Dex/End/Int/Edu/Soc), unskilled -3 penalty (Traveller, Cepheus Engine)
   - **freeform**: No dice or minimal resolution, fiction-first, safety tools as mechanics (Belonging Outside Belonging, Wanderhome)
   - **custom**: Hybrid or novel system that doesn't fit neatly into one tradition. This includes journaling RPGs, GMless games, map-drawing games, games where you play as a landscape or a community, lyric games, or anything truly experimental. Do NOT force these into another tradition -- use `custom` and let the game tell you what it is.

   **For truly novel games**: Not every entity type will apply. A journaling RPG may have only `mechanics/` (prompts) and `tensions/` (thematic). A GMless game may have no `entities/` at all. That's fine -- use only the entity types that make sense. Empty categories are better than forced ones.

3. **Extract raw game content.** Pull out every identifiable game element. Use the 6 entity types as a lens, not a requirement -- if a category doesn't exist in this game, skip it:
   - Attributes/stats/scores -- anything that defines a character numerically (if the game has characters)
   - Resources/pools -- anything that depletes and recovers (tokens, stress, supply, prompts remaining, etc.)
   - Mechanics/moves/actions -- how things get resolved (rolls, triggers, prompts, scene-framing rules, safety tools as mechanics, etc.)
   - Progression -- how characters or the game state changes over time (levels, advances, seasonal shifts, relationship evolution, narrative arcs)
   - Entities -- the things in the game (classes, playbooks, locations, prompts, oracle tables, community roles)
   - Tensions -- push-pull dynamics you observe (even if the source doesn't name them explicitly -- every game has tensions, even if they're thematic rather than mechanical)
4. **Track what you found and what's missing.** Make a mental inventory:
   - Which of the 6 entity types have clear source material?
   - Which are implied but not spelled out?
   - Which are completely absent from the source?

### Phase 3: Interview

The interview has one job: get enough signal to generate a draft game-state. The user should not feel like they're filling out a form.

**Principle: Draft first, correct later.** Ask the minimum needed to produce a reasonable draft. Generate it. Present it. Let the user correct what's wrong. This is always faster than exhaustive upfront questioning.

**For document ingestion:** Present what you extracted in a summary, ask about anything genuinely ambiguous (not everything missing — infer what you can from tradition norms), then proceed directly to generation.

**For guided interview (no source):** Walk through 3a and 3b below, then generate.

#### 3a: Identity (All Traditions — one batch)

Ask as a single message:

1. What is the game called?
2. What tradition? (Offer: d20, PbtA, FitD, OSR, Cepheus, freeform, custom, eurogame, autobattler, roguelike, deckbuilder, ccg, 4x, tactics, social-deduction, cooperative, idle, extraction, looter, immersive-sim)
3. One-sentence pitch — what makes this different from a standard [tradition] game?
4. What is the core loop? (What does a player DO on their turn / in a round / in a session?)

If the user's pitch already answers the core loop (e.g., "it's Blades but stress is shared across the crew"), don't re-ask it.

#### 3b: Core Differentiators (Tradition-Aware — one batch)

Based on the tradition, ask ONLY about what you can't infer from tradition norms. If the user said "standard 5e ability scores," you already know the stats. Don't ask.

Ask the single most diagnostic question per tradition family:

- **d20**: "What's different about your resolution, combat, or progression compared to standard d20?"
- **pbta**: "What are your unique moves and what stats do they roll?"
- **fitd**: "How does your stress/harm economy differ from standard Blades?"
- **osr**: "What procedures define the core gameplay loop?"
- **cepheus**: "What careers exist and how does your skill list differ from standard Cepheus?"
- **freeform/custom**: "Walk me through one complete scene or session cycle"
- **eurogame/deckbuilder/cooperative**: "Walk me through one complete turn"
- **autobattler/tactics**: "What are the unit types and how does a round play out?"
- **ccg**: "What's the cost system, main card types, and win condition?"
- **social-deduction**: "What roles exist and what's the phase structure?"
- **roguelike/extraction/looter**: "What does one run look like, and what persists between runs?"
- **4x**: "What victory conditions exist and what's the tech/expansion structure?"
- **idle**: "What's the basic loop, and what does prestige look like?"
- **immersive-sim**: "What player abilities exist and how do systems interact?"

Then one follow-up: "What else is importantly different from a standard [tradition] game?"

That's it for the interview. Two batches of questions, then move to generation.

**For everything the user didn't specify, use tradition defaults.** Standard stats, standard resource pools, standard progression curves. Mark inferred content in descriptions with `[inferred from tradition defaults]` so the user can spot and correct them during review.

#### Interview guidelines

- **Two rounds maximum** before generating. If you still have gaps after 3b, infer from tradition norms and flag during review.
- If the user says "it's like X," use X as the baseline. Ask ONLY about differences.
- If the user says "it's like X but with Y," you now know the baseline AND the key differentiator. You may not need 3b at all.
- Never ask about tensions during the interview. You'll identify them from the generated game-state and surface them during review.
- Never ask about design parameters during the interview. Default from tradition norms; the user can override during review.

### Phase 4: Game-State Generation

Generate YAML files for every game element you have extracted or learned through interview. Use tradition defaults to fill gaps — do not leave entities incomplete because the user didn't explicitly state something that is standard for their tradition. Follow the schema defined in `skills/attune/resources/game-state-schema.md` exactly.

#### Schema Reference

Every file requires these common base fields:

```yaml
id: unique-kebab-case-id
name: "Human Readable Name"
type: stats|resources|mechanics|progression|entities|tensions
description: "What this is and what it does in the game"
tradition: d20|pbta|fitd|osr|cepheus|freeform|custom|autobattler|roguelike|deckbuilder|ccg|4x|tactics|eurogame|social-deduction|cooperative|idle|extraction|looter|immersive-sim
tags: []

status: active|stub|deprecated  # Optional. Default: active (omit for normal entities)

depends_on: []    # Paths relative to game-state/. Required (empty array for leaf nodes).
affects: []       # Paths relative to game-state/. Required (empty array for leaf nodes).

# Optional on most entity types; required on tensions (see Phase 8c)
intent:
  summary: "one-line goal"
  rationale: "why this design"
  set_by: attune
  set_at: "ISO-8601"
  non_negotiable: false

created_by: attune
created_at: "ISO-8601"
last_modified_by: attune
last_modified_at: "ISO-8601"
```

#### Type-Specific Fields

**stats/** -- Attributes, ability scores, derived values:
- `range:` with `min`, `max`, `typical`, optional `modifier_formula`
- `used_by:` list of what this stat affects in plain language

**resources/** -- Depletable and recoverable pools:
- `pool:` with `min`, `max` (or `max_by_level`), `recovery:` (trigger + amount)
- `depletion_consequence:` what happens at zero
- `overflow_consequence:` (if applicable) what happens at max
- `pressure_rating:` low|medium|high

**mechanics/** -- Actions, reactions, conditions, triggers:
- `trigger:` when this activates
- `cost:` list of resource/amount pairs (can be empty)
- `resolution:` with `method`, `stat`, and outcome descriptions
- `interactions:` list of notable rules interactions

**progression/** -- Levels, features, gates:
- `progression_table:` keyed by level/advance number, listing features
- `scaling_notes:` list of observations about how this scales

**entities/** -- Classes, monsters, items, spells, playbooks:
- `subtype:` monster|class|item|spell|playbook|npc|etc.
- Type-specific fields like `stat_block`, `actions`, `traits`, `cr`, etc.
- `design_notes:` analytical observations about this entity

**tensions/** -- Named design tension pairs:
- `poles:` with `a:` and `b:`, each having `name`, `description`, `supported_by`
- `health:` balanced|a-dominant|b-dominant|collapsed
- `health_notes:` your analysis of the current state

#### Generation Rules

1. **One file per game entity.** Never combine multiple entities into one file.
2. **IDs are kebab-case** and unique within their entity type directory.
3. **Cross-references use relative paths** within `game-state/`: `mechanics/melee-attack.yaml`, not absolute paths.
4. **Set `created_by: attune`** and `created_at` to the current ISO-8601 timestamp.
5. **Fill `depends_on` and `affects`** by tracing relationships. If stat X is used by mechanic Y, then stat X `affects` mechanic Y, and mechanic Y `depends_on` stat X.
6. **Write files using the Write tool.** Do NOT use heredocs or Bash echo. Use the Write tool for every YAML file.
7. **Target fewer than 30 files** for a typical TTRPG system. Combine minor elements into broader entities rather than creating one file per spell, per item, etc. For example, create `entities/wizard-spells-1st.yaml` rather than individual files for each 1st-level spell.
8. **Descriptions should be analytical**, not just restating the rules. "Physical power. Affects melee attacks, carrying capacity, Athletics" is better than "Strength is an ability score."
9. **Auto-infer stubs for unresolved references.** After generating all entities, collect every path referenced in `depends_on`, `affects`, `resolution.stat`, and `cost[].resource`. For any reference that doesn't resolve to a generated entity, create a **stub entity**:
   ```yaml
   id: {inferred-from-path}
   name: "{Inferred Name}"
   type: {inferred-from-directory}
   status: stub
   description: "[STUB] Inferred from {referencing-entity} dependency. Awaiting enrichment."
   tradition: {same as game tradition}
   tags: [stub]
   depends_on: []
   affects: []
   created_by: attune-inferred
   created_at: "ISO-8601"
   last_modified_by: attune-inferred
   last_modified_at: "ISO-8601"
   ```
   Stubs have no type-specific fields. They exist to satisfy graph references. Report stub count to user after generation: "Created N stub entities for unresolved references. Run /attune again with source material to enrich them."

### Phase 5: Index Generation

After writing all entity files, generate or update `grimoires/gygax/game-state/index.yaml`.

```yaml
game: "Game Name"
tradition: d20|pbta|fitd|osr|cepheus|freeform|custom|autobattler|roguelike|deckbuilder|ccg|4x|tactics|eurogame|social-deduction|cooperative|idle|extraction|looter|immersive-sim
description: "Brief description of the game"
created_at: "ISO-8601"
last_modified_at: "ISO-8601"

design_parameters:              # All optional. Missing fields use tradition defaults.
  target_session_length: short|medium|long|campaign
  target_audience: newcomer|intermediate|enthusiast|mastery
  target_variance: low|medium|high
  target_lethality: gentle|moderate|brutal
  target_prep: zero-prep|light|moderate|heavy
  target_player_count: solo|small|standard|large
  target_interaction: direct-conflict|indirect-competition|cooperative|solo
  target_randomness: none|low|medium|high

# Tradition defaults (used when a field is omitted):
#
# TTRPG traditions:
#   | Parameter      | d20        | pbta         | fitd         | osr       | cepheus     | freeform  | custom       |
#   |----------------|------------|--------------|--------------|-----------|-------------|-----------|--------------|
#   | session_length | long       | medium       | medium       | medium    | long        | short     | medium       |
#   | audience       | intermediate| intermediate| intermediate| enthusiast| enthusiast  | newcomer  | intermediate |
#   | variance       | medium     | medium       | medium       | high      | low         | low       | medium       |
#   | lethality      | moderate   | moderate     | moderate     | brutal    | moderate    | gentle    | moderate     |
#   | prep           | moderate   | light        | light        | moderate  | moderate    | zero-prep | moderate     |
#   | player_count   | standard   | standard     | standard     | standard  | standard    | standard  | standard     |
#   | interaction    | cooperative| cooperative  | cooperative  | cooperative| cooperative| cooperative| cooperative |
#   | randomness     | medium     | medium       | medium       | medium    | low         | none      | medium       |
#
# Non-TTRPG traditions:
#   | Parameter      | autobattler | roguelike | deckbuilder | ccg     | 4x      | tactics | eurogame |
#   |----------------|-------------|-----------|-------------|---------|---------|---------|----------|
#   | session_length | medium      | medium    | medium      | short   | long    | medium  | medium   |
#   | audience       | intermediate| intermediate| intermediate| intermediate| enthusiast| intermediate| enthusiast |
#   | variance       | medium      | high      | medium      | medium  | medium  | medium  | low      |
#   | lethality      | moderate    | brutal    | gentle      | moderate| moderate| moderate| gentle   |
#   | prep           | zero-prep   | zero-prep | zero-prep   | light   | moderate| zero-prep| light   |
#   | player_count   | large       | solo      | standard    | solo    | solo    | solo    | standard |
#   | interaction    | indirect-competition | solo | indirect-competition | direct-conflict | direct-conflict | direct-conflict | indirect-competition |
#   | randomness     | medium      | high      | medium      | medium  | medium  | low     | low      |
#
#   | Parameter      | social-deduction | cooperative | idle   | extraction | looter   | immersive-sim |
#   |----------------|-----------------|-------------|--------|-----------|----------|---------------|
#   | session_length | short           | medium      | campaign| medium   | campaign | long          |
#   | audience       | newcomer        | newcomer    | newcomer| enthusiast| intermediate| intermediate|
#   | variance       | high            | medium      | low    | high      | medium   | low           |
#   | lethality      | moderate        | moderate    | gentle | brutal    | moderate | moderate      |
#   | prep           | zero-prep       | light       | zero-prep| zero-prep| zero-prep| zero-prep    |
#   | player_count   | large           | standard    | solo   | standard  | solo     | solo          |
#   | interaction    | social          | cooperative | solo   | direct-conflict | solo | solo         |
#   | randomness     | low             | medium      | none   | medium    | high     | none          |

entity_count:
  stats: 0
  resources: 0
  mechanics: 0
  progression: 0
  entities: 0
  tensions: 0

files:
  - path: stats/strength.yaml
    id: strength
    depends_on: []
    affects: [mechanics/melee-attack.yaml]
  # ... every file listed

graph_integrity:
  resolved_references: 0    # Count of depends_on/affects entries pointing to existing entities
  stub_count: 0             # Count of entities with status: stub
  stubs: []                 # List of stub file paths
  orphaned: []              # Entities with zero incoming AND zero outgoing edges
  circular: []              # Circular dependency chains (should always be empty)
  most_depended_on:
    - path: stats/strength.yaml
      dependents: 4
```

**Index rules:**
- `entity_count` must match the actual number of files in each directory. Stub entities count toward their type's total.
- `files` must list EVERY game-state file (including stubs) with its `path`, `id`, `depends_on`, and `affects`.
- `graph_integrity` must be computed by analyzing all cross-references:
  - `resolved_references`: count all `depends_on`/`affects` entries that point to existing files
  - `stub_count` and `stubs`: count and list entities with `status: stub`
  - `orphaned`: entities with empty `depends_on` AND empty `affects` AND zero appearances in any other entity's dependency lists
  - `circular`: circular dependency chains detected via topological sort (should be empty; flag if found)
  - `most_depended_on`: files sorted by incoming reference count (how many other entities list this in `depends_on`)
- **Backwards compatibility:** If an existing index uses `dependency_graph_summary`, convert it to `graph_integrity` on regeneration. Add `resolved_references`, `stub_count`, `stubs` fields with computed values.

### Phase 6: Validation

Before presenting results to the user, validate everything.

#### 6a: Schema Validation

For each generated YAML file, verify:
- [ ] All common base fields are present (`id`, `name`, `type`, `description`, `tradition`, `tags`, `depends_on`, `affects`, `created_by`, `created_at`, `last_modified_by`, `last_modified_at`)
- [ ] `id` is kebab-case and unique within its entity type directory
- [ ] `type` matches the directory the file lives in (`stats/` files have `type: stats`)
- [ ] `tradition` is one of: d20, pbta, fitd, osr, cepheus, freeform, custom, autobattler, roguelike, deckbuilder, ccg, 4x, tactics, eurogame, social-deduction, cooperative, idle, extraction, looter, immersive-sim
- [ ] Type-specific required fields are present (e.g., `range` for stats, `pool` for resources)

#### 6b: Cross-Reference Integrity

- [ ] Every path in `depends_on` and `affects` resolves to an existing file in game-state (including stubs created in Phase 4 rule 9). If a reference still doesn't resolve after stub creation, that is a validation error -- either create an additional stub or remove the broken reference.
- [ ] Cross-references are bidirectional where appropriate: if A `affects` B, then B should `depends_on` A. Asymmetry is a **warning** (fix it), not an error (don't block).
- [ ] No file references itself
- [ ] No circular dependency chains. Detect via topological sort. If circular dependencies exist, report them in `graph_integrity.circular` as a warning, not an error.
- [ ] `depends_on` and `affects` are present on ALL entities (including stubs). Missing fields are a schema violation -- add empty arrays `[]` for leaf nodes.

#### 6c: Index Consistency

- [ ] `entity_count` matches actual file counts
- [ ] Every file in the directory tree appears in `files`
- [ ] `graph_integrity` is accurate (resolved_references, stub_count, stubs, orphaned, circular, most_depended_on)

#### 6d: Repair

If validation finds issues:
- Fix missing cross-references by adding them
- Fix broken references by either creating the missing file or removing the reference
- Fix count mismatches by updating the index
- Re-validate after repairs

### Phase 7: Changelog Entry

Write a changelog entry to `grimoires/gygax/changelog/`:

**Filename:** `YYYY-MM-DD-HHMMSS-attune-initial.yaml` (or `attune-additive` for re-attunes)

```yaml
timestamp: "ISO-8601"
skill: attune
action: created|updated
summary: "Initial attunement from [source] — [N] entities across [types]"
entities_created:
  - stats/strength.yaml
  - stats/dexterity.yaml
  # ... all files created or modified
source: "docs/rulebook.md"  # or "guided interview" or URL
```

### Phase 8: Review and Correction

This is where the "draft first, correct later" loop pays off. Present the draft, surface what was inferred, and let the user drive corrections.

#### 8a: Present the Draft

1. **Summarize what you understood.** 3-5 sentences showing you get the game. This is your check — if the summary feels wrong to the user, the game-state is wrong too.
2. **Show entity counts.** Stats, resources, mechanics, progression, entities, tensions.
3. **Flag inferred content.** List everything you filled in from tradition defaults: "I used standard [tradition] defaults for: [list]. Correct anything that's off."
4. **Surface tensions.** List the tensions you identified from the game-state. Don't ask about each one individually — present them as a batch: "I see these tensions: [list]. Sound right? Any missing, or any that aren't real?"

#### 8b: Design Parameters (Auto-Defaulted)

Present the design parameters you defaulted from tradition norms as a table:

> "Design parameters (defaulted from [tradition] norms — override anything that doesn't fit):"
>
> | Parameter | Default | Your game |
> |-----------|---------|-----------|
> | Session length | [tradition default] | — |
> | Audience | [tradition default] | — |
> | Variance | [tradition default] | — |
> | Lethality | [tradition default] | — |
> | Prep | [tradition default] | — |
> | Player count | [tradition default] | — |
> | Interaction | [tradition default] | — |
> | Randomness | [tradition default] | — |

The user fills in only what differs. Anything left blank stays at the tradition default (omitted from `index.yaml` — analysis tools resolve defaults at read time).

#### 8c: Intent (Optional)

If tensions were identified, offer (don't require):

> "Want to set design intent on any of these tensions? This helps downstream analysis distinguish deliberate asymmetry from bugs. You can also do this later via `/homebrew --set-intent`."

If the user engages, capture intent using the standard schema:

```yaml
intent:
  summary: "one-line goal"
  rationale: "why this design"
  set_by: attune
  set_at: "ISO-8601"
  non_negotiable: false
```

If not, move on. Intent can always be added later.

#### 8d: Offer Next Steps

Based on what was built:
- If the game-state feels complete: "You're attuned. Try `/homebrew` to design a new mechanic, or `/augury` to check the math."
- If the user corrected things: apply corrections (Phase 9), re-validate, then offer next steps.
- If you spotted potential issues: "I noticed [observation]. You might want to run `/lore` for a pattern check, or `/augury` on [specific mechanic]."

### Phase 9: Iterative Refinement (if user continues)

If the user provides corrections or additional information:
1. Update the affected YAML files using Edit (not full rewrites).
2. Update cross-references in any files that depend on or are affected by the change.
3. Update `index.yaml`.
4. Append a new changelog entry for each round of changes.
5. Re-validate.

Continue until the user is satisfied or moves on to another skill.

## Tradition-Specific Guidance

Different traditions emphasize different entity types. This determines what you prioritize during extraction, what you can safely infer, and what the user's draft will look like.

| Tradition | Primary Entities | Secondary Entities | Often Sparse |
|-----------|-----------------|-------------------|--------------|
| d20 | stats, mechanics, progression | resources, entities | tensions |
| pbta | mechanics (moves), stats | progression (advances), entities (playbooks) | resources, tensions |
| fitd | resources (stress, harm), mechanics (actions, position/effect) | progression (crew advances), entities (crew sheet) | stats, tensions |
| osr | mechanics (procedures), entities (monsters, treasure), resources (supply, torches) | stats (minimal) | progression, tensions |
| cepheus | stats (6 characteristics), mechanics (skill checks, Effect), progression (lifepath/careers) | resources (Endurance as ablative pool), entities (career tables, equipment) | tensions |
| freeform | mechanics (tokens, prompts), tensions (safety tools as mechanics) | entities (character concepts) | stats, resources, progression |
| eurogame | mechanics (actions), resources (economy), entities (components) | progression (engine building), tensions | stats |
| deckbuilder | mechanics (buy/play/trash), entities (cards), resources (currency) | progression (deck thinning) | stats, tensions |
| cooperative | mechanics (actions), resources (shared pools), tensions (difficulty curve) | entities (roles), progression (escalation) | stats |
| autobattler | entities (units), mechanics (combat, synergies), resources (economy) | progression (leveling, items) | stats, tensions |
| tactics | entities (units), mechanics (combat, positioning), stats (unit attributes) | progression (unlocks), resources (action points) | tensions |
| ccg | entities (cards), mechanics (play/combat), resources (mana/cost) | progression (collection) | stats, tensions |
| roguelike | mechanics (run structure), progression (meta-unlocks), entities (items, builds) | resources (health, currency) | stats, tensions |
| extraction | mechanics (run/extract loop), resources (loot, risk), tensions (risk vs reward) | entities (gear), progression (hideout) | stats |
| looter | entities (loot, builds), mechanics (combat), progression (power curve) | resources (currencies) | stats, tensions |
| 4x | mechanics (expand/exploit/exterminate), progression (tech tree), tensions (victory paths) | resources (economy), entities (factions) | stats |
| social-deduction | entities (roles), mechanics (phases, voting), tensions (information asymmetry) | resources (lives) | stats, progression |
| idle | mechanics (click/automate loop), progression (prestige), resources (currencies) | tensions (active vs idle) | stats, entities |
| immersive-sim | mechanics (systemic interactions), entities (abilities, tools), tensions (approach trade-offs) | resources (ammo, upgrades), progression (ability tree) | stats |
| custom | **let the game decide** -- discover which types matter from the user's answers | varies | varies |

**Custom tradition guidance**: For games that don't fit any tradition, do NOT default to d20 patterns. Build entity types around what the game actually does. A journaling RPG might only have `mechanics/` and `tensions/`. A map-drawing game might only have `mechanics/` and `entities/`. It is completely valid for a game to have only 1-2 entity types populated.

## Handling Edge Cases

### Mid-Project Installation
If Gygax is installed into an existing Loa-managed repo that already has content:
- Check for existing `grimoires/gygax/` directory. If it exists with content, treat this as an additive attune.
- Do NOT delete or overwrite existing game-state files. Merge new content.
- Preserve all existing `created_by`, `created_at` timestamps. Only update `last_modified_*` fields.

### Very Large Sources
If the source material is extensive (full SRD, complete rulebook):
- Prioritize core mechanics and stats over exhaustive entity cataloguing.
- Create representative entities rather than every monster, every spell, every item.
- Note in the presentation: "I captured the core systems. Individual monsters/spells/items can be added incrementally via `/attune` with specific source sections."

### Minimal or Vague Sources
If the source is sparse (a half-page game concept, a few scattered notes):
- Extract what you can, then shift to interview mode for everything else.
- Be honest: "The source gave me [X], but I need to know more about [Y] to build useful game-state."

### "It's Like 5e" / "Standard PbtA"
When users reference well-known systems:
- Use your knowledge of that system to fill in the standard baseline.
- Ask ONLY about what differs: "I'll use standard 5e ability scores and saving throws as the baseline. What's different in your system?"
- Generate game-state for the baseline AND the modifications, clearly tagging what's standard vs. custom.

## Cross-Skill Chaining

After attunement completes, suggest next steps based on what was built:

```
Game attuned. Suggested next steps:

1. `/lore` -- check your design against known tradition anti-patterns
2. `/augury` -- validate the numerical balance of your mechanics
3. `/homebrew` -- start designing new mechanics with cross-system checking
4. `/cabal --newcomer --optimizer` -- quick stress-test for accessibility and exploits
5. To compare your system against an industry baseline, run `/attune --reference 5e-srd` (also available: pbta-baseline, cepheus-core).
```

Tailor suggestions to what the game-state contains. If the game has combat mechanics, emphasize `/augury`. If it's narrative-first, emphasize `/lore` and `/cabal --storyteller`. If the tradition is `cepheus` or uses a 2d6+mod resolution, suggest `/attune --reference cepheus-core` for direct comparison.

## Boundaries

- Does NOT design new mechanics (use `/homebrew` for that)
- Does NOT evaluate balance (use `/augury` for that)
- Does NOT simulate play (use `/cabal` for that)
- Does NOT apply heuristic pattern-matching (use `/lore` for that)
- Focuses solely on accurate extraction and representation of existing game content
- Does NOT make creative decisions -- if the source is ambiguous, ask the user rather than guessing
- Does NOT edit files in `.claude/` (System Zone)
- Does NOT generate more than 30 game-state files per attunement without explicit user request

## Output

**Primary (full attune workflow):** All artifacts are written to `grimoires/gygax/game-state/` organized by entity type:
- `grimoires/gygax/game-state/stats/*.yaml`
- `grimoires/gygax/game-state/resources/*.yaml`
- `grimoires/gygax/game-state/mechanics/*.yaml`
- `grimoires/gygax/game-state/progression/*.yaml`
- `grimoires/gygax/game-state/entities/*.yaml`
- `grimoires/gygax/game-state/tensions/*.yaml`
- `grimoires/gygax/game-state/index.yaml`

**Reference installation (`--reference` mode):** Artifacts are written to the references zone instead:
- `grimoires/gygax/references/{name}/game-state/` (full entity directory structure)
- `grimoires/gygax/references/{name}/metadata.yaml`

**Always written (both modes):**
- `grimoires/gygax/changelog/YYYY-MM-DD-HHMMSS-attune-*.yaml`

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| Source file not found | "I can't find a file at [path]. Check the path and try again, or run `/attune` without arguments for a guided interview." | Ask user to provide correct path |
| Source file is not readable text (binary, PDF, image) | "That file format isn't supported yet. Can you provide the content as markdown or plain text? Or run `/attune` without arguments and describe the game." | Redirect to interview mode |
| URL fetch fails | "I couldn't fetch that URL. Is it publicly accessible? You can also paste the content directly or point me at a local file." | Offer alternatives |
| Generated YAML fails validation | Do NOT show the user raw validation errors. Fix the file silently and re-validate. If the fix requires user input, ask a specific question. | Self-repair, then re-validate |
| Cross-reference points to entity not yet created | Create a minimal placeholder for the referenced entity with a `TODO` tag, or remove the reference if the entity is out of scope. | Placeholder or removal |
| Existing game-state conflicts with new source | "The existing game-state has [X], but the new source says [Y]. Which should I use?" | Ask user to resolve conflict |
| Source material is for a game you don't recognize | Proceed anyway. Extract what you can structurally. "I'm not familiar with this specific system, but I can see it uses [resolution mechanic]. Let me ask some targeted questions to fill in what I can't infer." | Shift to interview-heavy mode |
| User provides contradictory information | Surface the contradiction Socratically: "Earlier you said [X], but this seems to conflict with [Y]. Which is the intended design?" | Ask user to resolve |
| Unknown reference slug (`--reference {name}` not in bundled list) | "Reference '{name}' not available. Bundled references: 5e-srd, pbta-baseline, cepheus-core." | Stop; do not proceed |
| Reference already installed | "Reference '{name}' already installed at grimoires/gygax/references/{name}/. Reinstall? [y/N]" | Wait for user confirmation; reinstall only if confirmed |
