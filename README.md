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
- **It argues with you.** Four simulated player archetypes actively try to break your design. The Optimizer finds the exploit. The Rules Lawyer finds the ambiguity. They do it before your real players do.

## Commands

| Command | What It Does |
|---------|-------------|
| `/attune` | Point at a source — rulebook, repo, URL, or just describe your game — and Gygax builds structured game-state |
| `/homebrew` | Design or refine a mechanic. Gygax checks it against everything that already exists. |
| `/augury` | Run the numbers. DPR curves, probability distributions, encounter balance, resource economy. |
| `/cabal` | Summon four phantom players to stress-test your design. |
| `/lore` | 210 curated design heuristics across d20, PbtA, FitD, and OSR. Pattern-match your game against known failure modes. |
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

`/cabal` is an adversarial playtest. Four archetypes with distinct motivations interact with your design the way real players would — except they do it in minutes instead of months.

| Archetype | What They Do | Example Finding |
|-----------|-------------|-----------------|
| **The Optimizer** | Finds the degenerate strategy. Computes the most abusive build possible and checks if you intended it. | "Multiclassing Fighter 2 / Wizard X gives Shield + Second Wind for permanent advantage on saves. DPR is 40% higher than the next best option." |
| **The Explorer** | Wanders off the critical path. Tries every optional system and finds the dead design space. | "Your Crafting system has a trigger condition that never arises in actual play. Three pages of rules no one will use." |
| **The Storyteller** | Asks whether mechanics serve the fiction. Finds where narrative-focused players will feel unsupported. | "Your Bond system has no mechanical incentive to engage with it. The player who cares about story will feel like the game doesn't care about them." |
| **The Rules Lawyer** | Reads your text literally. Finds every ambiguity, undefined state, and RAW-vs-RAI conflict. | "'One additional action on your turn' — does that include bonus actions? This WILL cause a table argument." |

`/cabal` has memory. After a run, the next run checks for regressions — did your fix for the Optimizer's exploit break something the Explorer was relying on?

For non-traditional games, the archetypes adapt. In a journaling RPG, the Optimizer finds prompt sequences that game the system. In a GMless game, the Rules Lawyer probes authority distribution. If an archetype genuinely can't engage with your game, that itself is a finding.

## Typical Flow

```
/attune  →  /homebrew  →  /augury  →  /cabal  →  iterate
```

1. **Attune** to your game (ingest a doc or interview)
2. **Homebrew** a mechanic (get cross-system consistency feedback)
3. **Augury** the math (get specific numbers, not approximations)
4. **Cabal** stress-test (find what players will exploit, ignore, or argue about)
5. Fix what broke, repeat from 2

You don't have to follow this order. `/cabal` a napkin sketch before you've done any balance work. `/lore` your half-finished system to see which known anti-patterns you're walking into. Jump in wherever.

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

## v1 Scope

TTRPG-focused. Card games, video games, and broader systems design are on the v2 roadmap.

## License

MIT
