# Gygax

TTRPG systems analyst for the [Loa](https://github.com/0xHoneyJar/loa) ecosystem. Design, balance, and stress-test tabletop RPG mechanics with persistent game-state and adversarial playtesting.

Built on [construct-base](https://github.com/0xHoneyJar/construct-base).

## What It Does

Point Gygax at a rulebook, a repo, or just describe your game — it builds a structured understanding and gives you real analysis, not vibes.

- **Persistent game-state**: Cross-system consistency checking that remembers your stamina system when you're designing your dodge mechanic
- **Real math**: DPR curves, probability distributions, encounter balance — specific numbers, not "seems overpowered"
- **Adversarial playtesting**: Four simulated player archetypes try to break your design before your real players do
- **Curated design wisdom**: 210 heuristics across d20, PbtA, FitD, and OSR traditions

## Commands

| Command | What It Does |
|---------|-------------|
| `/attune` | Ingest a source (doc, repo, URL) or guided interview to build game-state |
| `/homebrew` | Design or refine a mechanic with cross-system consistency checking |
| `/augury` | Run numerical balance analysis grounded in game-state |
| `/cabal` | Stress-test with simulated player archetypes |
| `/lore` | Apply curated TTRPG design heuristics by tradition |
| `/gygax` | Status overview — what's in game-state, recent analysis |

## Quick Start

```
/attune docs/my-rulebook.md
```

Or just:

```
/attune
```

And Gygax will interview you about your game.

## Typical Flow

```
/attune  →  /homebrew  →  /augury  →  /cabal  →  iterate
```

1. **Attune** to your game (ingest or interview)
2. **Homebrew** a mechanic (get cross-system feedback)
3. **Augury** the math (get specific numbers)
4. **Cabal** stress-test (find what players will exploit)
5. Fix and repeat

## Supported Traditions

- d20 (D&D, Pathfinder, 13th Age)
- Powered by the Apocalypse (Dungeon World, Masks)
- Forged in the Dark (Blades in the Dark)
- Old School Renaissance (OSE, Knave, Cairn)
- Freeform / narrative-first (Wanderhome)

## What Gygax Is Not

- Not a code generator — it analyzes and advises, it doesn't write your game
- Not a writer — no narrative prose, no flavor text
- Not a replacement for playtesting — it supplements with structural analysis
- Not omniscient — it will tell you when it doesn't know enough to have an opinion

## v1 Scope

TTRPG-only. Card games, video games, and broader system design are on the v2 roadmap.

## License

MIT
