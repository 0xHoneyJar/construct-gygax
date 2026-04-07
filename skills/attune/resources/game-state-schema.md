# Gygax Game-State YAML Schema

This document defines the structured YAML schema for game-state files stored in `grimoires/gygax/game-state/`. All Gygax skills read from and write to this schema.

## Common Base Fields

Every game-state YAML file shares these required fields:

```yaml
id: unique-kebab-case-id           # Unique within entity type
name: "Human Readable Name"        # Display name
type: stats|resources|mechanics|progression|entities|tensions
description: "What this is and what it does in the game"
tradition: d20|pbta|fitd|osr|freeform|custom
tags: []                           # Freeform tags for querying

depends_on: []                     # Paths relative to game-state/
affects: []                        # Paths relative to game-state/

created_by: attune|homebrew        # Which skill created this
created_at: "ISO-8601"
last_modified_by: attune|homebrew
last_modified_at: "ISO-8601"
```

## Entity Type: stats/

Attributes, ability scores, derived values — the numbers on a character sheet.

```yaml
id: strength
name: "Strength"
type: stats
description: "Physical power. Affects melee attacks, carrying capacity, Athletics."
tradition: d20
tags: [ability-score, physical, core]

range:
  min: 1
  max: 30
  typical: 8-18
  modifier_formula: "floor((value - 10) / 2)"

used_by:
  - "Melee attack rolls"
  - "Strength saving throws"
  - "Athletics checks"

depends_on: []
affects:
  - mechanics/melee-attack.yaml
  - mechanics/athletics-check.yaml

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

**For PbtA stats:**

```yaml
id: hot
name: "Hot"
type: stats
description: "Attractiveness, social leverage, and seductive power."
tradition: pbta
tags: [stat, social]

range:
  min: -1
  max: 3
  typical: -1-2

used_by:
  - "Turn Someone On"
  - "Manipulate an NPC"

depends_on: []
affects:
  - mechanics/turn-someone-on.yaml

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

## Entity Type: resources/

Depletable and recoverable pools — anything that gets spent and restored.

```yaml
id: spell-slots-1st
name: "1st-Level Spell Slots"
type: resources
description: "Expendable resource for casting 1st-level spells. Recovers on long rest."
tradition: d20
tags: [spellcasting, rest-recovery, per-day]

pool:
  min: 0
  max_by_level:
    1: 2
    2: 3
    3: 4
  recovery:
    trigger: long-rest
    amount: full

depletion_consequence: "Cannot cast 1st-level spells without using higher slots or cantrips."
pressure_rating: medium

depends_on:
  - progression/wizard-class.yaml
  - mechanics/long-rest.yaml
affects:
  - mechanics/spellcasting.yaml

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

**For FitD stress:**

```yaml
id: stress
name: "Stress"
type: resources
description: "Accumulated pressure from desperate situations. At max, triggers trauma."
tradition: fitd
tags: [consequence, escalation]

pool:
  min: 0
  max: 9
  recovery:
    trigger: downtime-activity
    amount: variable

depletion_consequence: "N/A (stress fills up, not down)"
overflow_consequence: "Trauma — permanent character change"
pressure_rating: high

depends_on:
  - mechanics/resistance-roll.yaml
affects:
  - mechanics/trauma.yaml
  - progression/retirement.yaml

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

## Entity Type: mechanics/

Actions, reactions, conditions, triggers — how the game plays.

```yaml
id: dodge-reaction
name: "Dodge (Reaction)"
type: mechanics
description: "Spend stamina to avoid an incoming attack. Uses reaction for the round."
tradition: d20
tags: [combat, reaction, defensive]

trigger: "When targeted by a melee or ranged attack"
cost:
  - resource: resources/stamina.yaml
    amount: 2
  - resource: mechanics/reaction-economy.yaml
    amount: 1

resolution:
  method: ability-check
  stat: stats/dexterity.yaml
  dc: "attacker's attack roll"
  success: "Attack misses"
  failure: "Attack hits normally, stamina still spent"

interactions:
  - "Cannot dodge if stamina < 2"
  - "Cannot dodge if reaction already used this round"
  - "Heavy armor imposes disadvantage on the check"

depends_on:
  - resources/stamina.yaml
  - stats/dexterity.yaml
  - mechanics/reaction-economy.yaml
affects:
  - resources/stamina.yaml

created_by: homebrew
created_at: "2026-04-07T14:00:00Z"
last_modified_by: homebrew
last_modified_at: "2026-04-07T14:00:00Z"
```

**For PbtA moves:**

```yaml
id: defy-danger
name: "Defy Danger"
type: mechanics
description: "When you act despite an imminent threat, say how you deal with it and roll."
tradition: pbta
tags: [basic-move, reactive]

trigger: "When you act despite an imminent threat"
cost: []

resolution:
  method: roll-2d6-plus-stat
  stat: "varies by fiction"
  outcomes:
    "10+": "You do it, no cost"
    "7-9": "Worse outcome, hard bargain, or ugly choice"
    "6-": "GM makes a move"

interactions:
  - "Stat used depends on how you describe dealing with the danger"
  - "GM determines when this triggers, not the player"

depends_on: []
affects: []

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

## Entity Type: progression/

Levels, features, gates — how characters grow over time.

```yaml
id: fighter-class
name: "Fighter"
type: progression
description: "Martial class focused on weapon mastery and combat superiority."
tradition: d20
tags: [class, martial, core]

progression_table:
  1:
    features: [fighting-style, second-wind]
    hit_die: d10
    proficiency_bonus: 2
  2:
    features: [action-surge]
  3:
    features: [martial-archetype]
  5:
    features: [extra-attack]
    proficiency_bonus: 3

scaling_notes:
  - "Linear damage scaling via Extra Attack (5, 11, 20)"
  - "Action Surge provides nova potential — strongest in short fights"
  - "No inherent magical capability — dependent on items for magical damage"

depends_on:
  - stats/strength.yaml
  - stats/constitution.yaml
affects:
  - mechanics/action-surge.yaml
  - mechanics/second-wind.yaml

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

## Entity Type: entities/

Classes, monsters, items, spells, playbooks — the things in the game.

```yaml
id: goblin
name: "Goblin"
type: entities
subtype: monster
description: "Small, cowardly but cunning humanoid. Dangerous in groups."
tradition: d20
tags: [monster, humanoid, low-cr]

stat_block:
  ac: 15
  hp: 7
  speed: 30
  str: 8
  dex: 14
  con: 10

actions:
  - name: Scimitar
    attack_bonus: 4
    damage: "1d6+2 slashing"
  - name: Shortbow
    attack_bonus: 4
    damage: "1d6+2 piercing"
    range: "80/320"

traits:
  - name: Nimble Escape
    description: "Can Disengage or Hide as a bonus action"

cr: 0.25
xp: 50

design_notes:
  - "Nimble Escape makes goblins harder to pin down than CR 1/4 suggests"
  - "In groups of 6+, action economy overwhelms low-level parties"

depends_on:
  - mechanics/melee-attack.yaml
  - mechanics/ranged-attack.yaml
affects: []

created_by: attune
created_at: "2026-04-07T12:00:00Z"
last_modified_by: attune
last_modified_at: "2026-04-07T12:00:00Z"
```

## Entity Type: tensions/

Named design tension pairs — intentional push-pull dynamics.

```yaml
id: survivability-vs-resource-pressure
name: "Survivability vs. Resource Pressure"
type: tensions
description: "Defensive options cost resources, creating tension between staying alive now and having resources for later."
tradition: d20
tags: [combat, pacing, resource-management]

poles:
  a:
    name: "Survivability"
    description: "Player can avoid damage and stay in the fight"
    supported_by:
      - mechanics/dodge-reaction.yaml
      - mechanics/second-wind.yaml
      - resources/hit-points.yaml
  b:
    name: "Resource Pressure"
    description: "Defensive options deplete limited resources"
    supported_by:
      - resources/stamina.yaml
      - resources/spell-slots-1st.yaml

health: balanced
health_notes: "Dodge costs 2 stamina from a pool of 10, giving 5 dodges per rest. If stamina pool increases, survivability dominates and combat loses tension."

depends_on:
  - mechanics/dodge-reaction.yaml
  - resources/stamina.yaml
affects: []

created_by: homebrew
created_at: "2026-04-07T14:00:00Z"
last_modified_by: homebrew
last_modified_at: "2026-04-07T14:00:00Z"
```

## Index File: game-state/index.yaml

The root manifest summarizing all game-state files. Created by `/attune`, updated by `/homebrew`.

```yaml
game: "Game Name"
tradition: d20|pbta|fitd|osr|freeform|custom
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
  # ... all files listed

dependency_graph_summary:
  most_depended_on: []
  orphaned: []
  circular: []
```

Skills load `index.yaml` first to understand the full game-state, then selectively load specific files based on what they need.

## Design Principles

1. **Schema simplicity over expressiveness** — must be reliably LLM-generatable during `/attune`
2. **Per-entity files** — one file per game entity, not monolithic documents
3. **Cross-references via paths** — `depends_on` and `affects` use relative paths within game-state/
4. **Tradition-agnostic structure** — same 6 types work for d20, PbtA, FitD, OSR, freeform
5. **Context budget** — target <30 files for a typical TTRPG system
6. **Append-only changelog** — mutations logged to `grimoires/gygax/changelog/`
