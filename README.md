# Gygax

A TTRPG systems analyst for the [Loa](https://github.com/0xHoneyJar/loa) ecosystem.

You design a mechanic. Gygax tells you your stamina system doesn't regenerate in combat, so that dodge reaction you're excited about becomes a trap option after round two. Before your players find out at the table.

Built on [construct-base](https://github.com/0xHoneyJar/construct-base).

## Why

Designing a TTRPG is juggling twenty interlocking systems in your head. Change one number and three mechanics break in ways you won't notice until session twelve. The feedback loop between "I think this works" and "oh, it definitely doesn't" is measured in weeks of real playtesting.

Gygax shortens that loop to minutes. Not by replacing playtesting — by catching the structural problems before you ever sit down at a table.

**What makes it different from just asking an LLM about game design:**

- **It remembers.** Gygax maintains structured game-state across sessions. When you're designing your spell system, it still knows about your stamina system. Cross-system interactions are where the real bugs hide.
- **It does math, not vibes.** "Seems overpowered" isn't actionable. "47 DPR against a 180 HP pool gives a TTK of 3.8 seconds — below your target of 6-8" is.
- **It argues with you.** Nine simulated player archetypes stress-test your design from every angle — the Optimizer finds the exploit, the Newcomer can't figure out the rules, the GM is drowning in cognitive load. They do it before your real players do.
- **It lets you explore.** Fork your game-state, try a change, see the consequences, compare alternatives. Commit the good branch, discard the rest. Design is branching, not linear.

## Commands

| Command | What It Does |
|---------|-------------|
| `/attune` | Point at a source — rulebook, repo, URL, or just describe your game — and Gygax builds structured game-state |
| `/homebrew` | Design or refine a mechanic. Gygax checks it against everything that already exists. |
| `/augury` | Run the numbers. DPR curves, probability distributions, encounter balance, resource economy. |
| `/cabal` | Summon up to nine phantom players to stress-test your design with scenario walkthroughs. |
| `/lore` | 210 curated design heuristics across d20, PbtA, FitD, and OSR. Pattern-match your game against known failure modes. |
| `/scry` | Fork your game-state, explore a change, see the impact. Compare branches, commit the best one. |
| `/gygax` | Where am I? What's in game-state? What did the last analysis find? |

## Quick Start

**Claude Code** (one-liner):

```bash
curl -fsSL https://raw.githubusercontent.com/0xHoneyJar/construct-gygax/main/install.sh | bash
```

Run from your project root. Installs skills into `.claude/skills/`, creates grimoire structure, wires up identity. Then:

```
/attune
```

**With [Loa](https://github.com/0xHoneyJar/loa)**:

```
constructs install gygax
```

## The Cabal

`/cabal` is scenario-based playtest simulation. Nine archetypes walk through your design beat by beat — not just analyzing it from a distance, but experiencing it the way a player would. You compose the panel for each run.

| Archetype | What They Do |
|-----------|-------------|
| **The Optimizer** | Finds the degenerate strategy. Computes the most abusive build and checks if you intended it. |
| **The Explorer** | Wanders off the critical path. Tries every optional system and finds the dead design space. |
| **The Storyteller** | Asks whether mechanics serve the fiction. Finds where the drama dies. |
| **The Rules Lawyer** | Reads your text literally. Finds every ambiguity and undefined state. |
| **The Newcomer** | Has never played a TTRPG. Finds where your game fails to teach itself. |
| **The Chaos Agent** | Goes off-script. "I befriend the monster." Finds where no mechanic covers the action. |
| **The GM** | Runs the game behind the screen. Finds where cognitive load explodes. |
| **The Anxious Player** | Overwhelmed by choices. Finds where decision paralysis kills the fun. |
| **The Veteran** | 50 sessions deep. Finds where the game stops being interesting. |

Pick your panel: `/cabal --newcomer --gm --optimizer` tests accessibility, runnability, and exploitability. `/cabal --all` throws every lens at the design. No flags? Gygax picks a context-aware default based on what you're testing.

**Experience tracking.** Each archetype generates experience signals at every beat — confusion, excitement, dead time, decision paralysis, cognitive overload, mastery reward. When different archetypes have radically different experiences of the same moment (the Optimizer is thriving while the Newcomer is drowning), that's an **experience divergence** — an invisible fracture only visible by comparing across player types.

**Regression memory.** Each run checks previous reports. Did your fix for the Optimizer's exploit break something the Explorer was relying on?

For non-traditional games, the archetypes adapt. In a journaling RPG, the Optimizer finds prompt sequences that game the system. If an archetype genuinely can't engage with your game, that itself is a finding.

## Typical Flows

**Design loop:**
```
/attune  →  /homebrew  →  /augury  →  /cabal  →  iterate
```

**Explore-then-commit:**
```
/scry "what if threshold was 4?"  →  /scry "what if threshold was 5?"  →  /scry compare  →  /scry commit
```

1. **Attune** to your game (ingest a doc or interview)
2. **Homebrew** a mechanic (get cross-system consistency feedback)
3. **Augury** the math (get specific numbers, not approximations)
4. **Cabal** stress-test (find what players will exploit, ignore, or argue about)
5. **Scry** alternatives (fork, test, compare, commit the best branch)
6. Fix what broke, repeat from 2

Every skill tells you what to do next. Augury finds a balance problem? It suggests the exact `/homebrew` invocation to fix it. Cabal finds an accessibility issue? It points you to `/homebrew` with the specific mechanic.

You don't have to follow any order. `/cabal` a napkin sketch before you've done any balance work. `/scry` three alternative approaches before committing to one. Jump in wherever.

## Works With Any TTRPG

Gygax has deep heuristics for established traditions:

- **d20** — D&D, Pathfinder, 13th Age
- **Powered by the Apocalypse** — Dungeon World, Masks, Monsterhearts
- **Forged in the Dark** — Blades in the Dark, Scum and Villainy
- **Old School Renaissance** — OSE, Knave, Cairn, Into the Odd
- **Freeform / narrative-first** — Wanderhome, Belonging Outside Belonging

But it also works with games that don't fit any tradition. Journaling RPGs, map-drawing games, lyric games, GMless experiments, games where you play as a landscape — Gygax meets the game where it is. If your game only has two entity types, that's fine. If none of the 210 curated heuristics apply, Gygax falls back to structural analysis: decision space, loop completeness, player agency, emotional arc.

The goal is always the same: does this design do what you think it does?

## What Gygax Is Not

- **Not a code generator.** It doesn't write your game. It analyzes and advises.
- **Not a writer.** No flavor text, no narrative prose, no lore.
- **Not a replacement for real playtesting.** It supplements with structural analysis. Real players will always surprise you in ways a simulation can't.
- **Not omniscient.** It will tell you when it doesn't know enough about a genre or tradition to have a strong opinion, rather than guessing.

## The Grimoire

Everything Gygax produces is saved as clean, presentable markdown in `grimoires/gygax/`. Hand someone the directory and they have the complete design journal — game-state, design documents, balance reports, playtest walkthroughs, lore scans, design branches. No conversation context needed.

## Scope

TTRPG-focused. Card games, video games, and broader systems design are on the roadmap.

## License

MIT
