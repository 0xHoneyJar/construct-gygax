---
name: attune
description: Onboard and ingest a TTRPG system, rulebook, or game reference into Gygax
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash, WebFetch
---

# Attune

Onboard and ingest a TTRPG system, rulebook, or game reference into the Gygax construct. This skill reads source material -- markdown documents, plain text, URLs, repositories, or conversational input -- extracts core mechanics, and produces structured game-state YAML artifacts that all other Gygax skills depend on.

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

### Phase 3: Guided Interview

Whether you are filling gaps after ingestion or building from scratch, the interview follows this structure. Adapt depth based on what you already know.

**For document ingestion:** Present what you extracted, then ask targeted questions about gaps.

**For guided interview (no source):** Walk through these areas in order, building understanding incrementally.

#### 3a: Game Identity

Ask about (skip if already known from source):
- What is the game called?
- What tradition does it follow? (Offer the list: d20, PbtA, FitD, OSR, Cepheus, freeform, custom)
- One-sentence description of what makes this game different
- What is the core resolution mechanic? (Roll d20+mod vs DC, roll 2d6+stat, dice pool, etc.)

#### 3b: Stats and Attributes

Ask about (skip if already extracted):
- What stats/attributes do characters have?
- What are their ranges? (e.g., 1-20 with modifiers, -1 to +3)
- How are they generated? (Point buy, random roll, fixed array)
- What does each stat affect mechanically?

#### 3c: Resources and Pools

Ask about:
- What do characters spend? (HP, spell slots, stamina, stress, ammo, luck, etc.)
- How do they recover? (Rest, downtime, moves, abilities)
- What happens when a resource hits zero or max? (Death, trauma, out of action)

#### 3d: Core Mechanics

Ask about:
- What are the basic actions a character can take? (Attack, cast, move, help, etc.)
- How does the core resolution work step-by-step?
- What are the possible outcomes? (For PbtA: 10+/7-9/6-. For d20: success/fail)
- Are there reactions, interrupts, or triggered abilities?
- How does combat flow? (Initiative, turns, rounds, action economy)

#### 3e: Progression

Ask about:
- How do characters advance? (XP, milestones, advances, fiction triggers)
- What do they gain? (Features, stat increases, new moves, new abilities)
- Are there levels, tiers, or phases of play?
- How does power scale from start to endgame?

#### 3f: Entities

Ask about:
- What character types exist? (Classes, playbooks, archetypes)
- Are there monsters/NPCs with stat blocks?
- What items, equipment, or gear matters mechanically?
- Are there spells, powers, or special abilities with their own rules?

#### 3g: Tensions (Observed or Designed)

After gathering the above, identify and confirm tensions:
- "Based on what you've described, I see a tension between [X] and [Y]. Is that intentional?"
- "Your resource recovery is tied to [rest type], but combat drains [resource] at [rate]. This creates a pacing tension around [observation]. Does that match your design intent?"

**Interview guidelines:**
- Ask 2-4 questions at a time, not a wall of 20
- After each round, summarize what you now understand before asking more
- Be specific -- "How does Strength affect melee attacks?" not "Tell me about stats"
- If the user says "it's like 5e" or "standard PbtA moves", use your knowledge to fill in the standard version and ask what differs
- Stop interviewing when you have enough to generate at least stats, resources, and core mechanics. Entities and tensions can be sparse initially.

### Phase 3.5: Intent Capture

This phase runs AFTER the interview (Phase 3) and BEFORE writing game-state files (Phase 4). Its purpose is to capture designer intent for tensions and high-signal mechanics, so that downstream analysis skills can distinguish deliberate asymmetry from unintended imbalance.

**Skip this phase entirely if:**
- The user invokes `/attune` with "skip intent prompts" at any point during the session.
- The source document contains explicit design rationale sections (headings such as "Design Notes," "Designer's Commentary," "Intent," or similar). In that case, extract intent from those sections programmatically and populate the intent fields without asking.

**Otherwise, prompt as follows:**

#### Required: Tensions

For EVERY tension entity identified during Phase 3, you MUST ask the user for intent before proceeding to Phase 4. Do not skip any tension.

Prompt template:
> "I see a tension between **[Pole A name]** and **[Pole B name]**. What's the design intent — is the asymmetry deliberate, or is one pole intended to dominate?"

Wait for a response. Use the answer to populate the `intent` field on the tension entity.

#### Encouraged: High-Connectivity Mechanics

From your dependency analysis, identify the top 3 mechanics by incoming dependency count (i.e., the mechanics that appear most frequently in other entities' `depends_on` lists). For each, ask:

> "This mechanic has [N] other entities depending on it. What's the design goal — what problem is this solving?"

You may combine these into a single message if asking about all three at once is more natural.

#### Encouraged: Unusual Probability Distributions

If any mechanic has a non-obvious probability shape — unusual stat modifier curves, outcome bands that are narrower or wider than tradition norms, exploding dice, threshold effects, unskilled penalties — surface the observation and ask:

> "I notice [specific observation, e.g., 'the unskilled -3 penalty means untrained characters succeed roughly 17% of the time at target 8']. Is this intentional?"

#### Captured Intent Schema

Record all captured intent using this structure:

```yaml
intent:
  summary: "one-line goal"
  rationale: "why this design"
  set_by: attune
  set_at: "ISO-8601"
  non_negotiable: false  # default; user can upgrade to true if they confirm the design is fixed
```

If the user explicitly says a design is final or locked, set `non_negotiable: true`. This suppresses Warning-level findings (but never Critical) in downstream augury analysis.

#### Asking Guidelines

- Batch questions where possible: ask about all 3 high-connectivity mechanics in one message.
- Ask tension intent questions one at a time — tensions are nuanced enough to warrant focused responses.
- If the user says "I don't know yet" or "TBD," leave the `intent` block absent from that entity. Do NOT write a placeholder intent.
- Keep prompts short and specific. Reference the actual mechanic or tension name and the concrete numbers.

### Phase 4: Game-State Generation

Generate YAML files for every game element you have extracted or learned through interview. Follow the schema defined in `skills/attune/resources/game-state-schema.md` exactly.

#### Schema Reference

Every file requires these common base fields:

```yaml
id: unique-kebab-case-id
name: "Human Readable Name"
type: stats|resources|mechanics|progression|entities|tensions
description: "What this is and what it does in the game"
tradition: d20|pbta|fitd|osr|cepheus|freeform|custom
tags: []

depends_on: []    # Paths relative to game-state/
affects: []       # Paths relative to game-state/

# Optional on most entity types; required on tensions (see Phase 3.5)
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

### Phase 5: Index Generation

After writing all entity files, generate or update `grimoires/gygax/game-state/index.yaml`.

```yaml
game: "Game Name"
tradition: d20|pbta|fitd|osr|cepheus|freeform|custom
description: "Brief description of the game"
created_at: "ISO-8601"
last_modified_at: "ISO-8601"

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

dependency_graph_summary:
  most_depended_on: []
  orphaned: []
  circular: []
```

**Index rules:**
- `entity_count` must match the actual number of files in each directory.
- `files` must list EVERY game-state file with its `path`, `id`, `depends_on`, and `affects`.
- `dependency_graph_summary` must be computed by analyzing all cross-references:
  - `most_depended_on`: files that appear most frequently in other files' `depends_on` lists
  - `orphaned`: files with empty `depends_on` AND empty `affects` (no connections)
  - `circular`: any circular dependency chains (should be empty; flag if found)

### Phase 6: Validation

Before presenting results to the user, validate everything.

#### 6a: Schema Validation

For each generated YAML file, verify:
- [ ] All common base fields are present (`id`, `name`, `type`, `description`, `tradition`, `tags`, `depends_on`, `affects`, `created_by`, `created_at`, `last_modified_by`, `last_modified_at`)
- [ ] `id` is kebab-case and unique within its entity type directory
- [ ] `type` matches the directory the file lives in (`stats/` files have `type: stats`)
- [ ] `tradition` is one of: d20, pbta, fitd, osr, cepheus, freeform, custom
- [ ] Type-specific required fields are present (e.g., `range` for stats, `pool` for resources)

#### 6b: Cross-Reference Integrity

- [ ] Every path in `depends_on` and `affects` points to a file that actually exists in game-state
- [ ] Cross-references are bidirectional where appropriate: if A `affects` B, then B should `depends_on` A
- [ ] No file references itself

#### 6c: Index Consistency

- [ ] `entity_count` matches actual file counts
- [ ] Every file in the directory tree appears in `files`
- [ ] `dependency_graph_summary` is accurate

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

### Phase 8: Presentation and Confirmation

Present the results to the user. This is where the Gygax persona shines -- be a collaborator, not a robot.

1. **Summarize what you understood.** Give a 3-5 sentence overview of the game system as you understood it. This is your chance to show the user you actually get their game.
2. **Show entity counts.** How many stats, resources, mechanics, progression items, entities, and tensions you created.
3. **Highlight interesting findings.** Did you notice any tensions? Any mechanics that reference resources in interesting ways? Any gaps that might matter? State these as observations, not judgments.
4. **Call out gaps explicitly.** "I didn't find information about [X] in the source. This might matter for [Y skill] later. Want to fill that in now, or come back to it?"
5. **Offer next steps.** Based on what you found:
   - If the game-state feels complete: "You're attuned. Try `/homebrew` to design a new mechanic, or `/augury` to check the math on what exists."
   - If gaps remain: "Want to fill in [specific gaps] now, or proceed with what we have?"
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

Different TTRPG traditions emphasize different entity types. Adjust your extraction and interview focus accordingly.

| Tradition | Primary Entities | Secondary Entities | Often Sparse |
|-----------|-----------------|-------------------|--------------|
| d20 | stats, mechanics, progression | resources, entities | tensions |
| pbta | mechanics (moves), stats | progression (advances), entities (playbooks) | resources, tensions |
| fitd | resources (stress, harm), mechanics (actions, position/effect) | progression (crew advances), entities (crew sheet) | stats, tensions |
| osr | mechanics (procedures), entities (monsters, treasure), resources (supply, torches) | stats (minimal) | progression, tensions |
| cepheus | stats (6 characteristics), mechanics (skill checks, Effect), progression (lifepath/careers) | resources (Endurance as ablative pool), entities (career tables, equipment) | tensions |
| freeform | mechanics (tokens, prompts), tensions (safety tools as mechanics) | entities (character concepts) | stats, resources, progression |
| custom | **let the game decide** -- interview to discover which types matter | varies | varies |

**Custom tradition guidance**: For games that don't fit any tradition, do NOT default to d20 patterns. Ask the user what the core loop of their game is. A journaling RPG's core loop might be "draw prompt → write → reflect." A map-drawing game's core loop might be "place feature → name it → connect it." Build entity types around what the game actually does, not what a traditional TTRPG looks like. It is completely valid for a game to have only 1-2 entity types populated.

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
