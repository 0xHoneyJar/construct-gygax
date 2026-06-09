# Reference: Formal Design Language — FADT & MDA

Attributed summary of two foundational game-design vocabularies that ground what gygax *is*:
a formal, shared language for analyzing games. Concepts paraphrased in our own words with
citations.

**Primary sources:**
- Doug Church, *"Formal Abstract Design Tools"* (Gamasutra/Game Developer, 1999) — Looking
  Glass / Eidos / Valve designer.
- Robin Hunicke, Marc LeBlanc & Robert Zubeck, *"MDA: A Formal Approach to Game Design and
  Game Research"* (2004), building on Church's work.

**Secondary gloss consulted:** Bloomsbury textbook supplement, *"More on the language of game
design and research"* (derivative student summary; cite the primaries above, not this).

**Why it matters to gygax:** Church's premise is that videogames lack a shared formal language,
and *"shared language is a critical tool for analysis… it creates cognitive shortcuts when
talking to other designers."* gygax is, in effect, a working instance of that idea — a formal
analytical vocabulary applied across traditions. Related: `design-failure-postmortem.md`,
`secret-science-of-games.md` (the intent-vs-reality lens these all share).

## FADT — Formal Abstract Design Tools (Church 1999)

A "formal" language defines the nuts and bolts; an "abstract" one describes the concepts/feel.
Church's three principles common to (nearly) all videogames:

1. **Player Intention.** The game offers options; the player forms a *plan* based on their
   understanding of the world and its limits, then acts. (Arkham: wading in fails → the player
   learns to chain attacks.) The designer's job is to make *why* an attempt succeeded or failed
   legible, so the player can build a predictive model. Abstract because the *idea* of "chaining
   for advantage" transfers across unrelated games (brawler combos ≈ passing chains in a soccer
   game).
2. **Perceivable Consequences** (of interaction). The world reacts *consistently* to the player.
   The design question: *"What would it be reasonable for the player to expect in this
   scenario?"* Traps must be **telegraphed** so the player can build an intention model — even
   sudden death is fair if the player can tell they did the *wrong* action and look for the
   right one (Tomb Raider boulder: run straight → crushed; step aside → safe). Random,
   untelegraphed sudden-death (arcade coin-model traps) is the anti-pattern.
3. **Story / Narrative.** Ranges from on-rails to emergent; in choice-light games the *combat
   system* often carries the intention/consequence load.

> **The key articulation for gygax (engine-tuning):** Church distinguishes a **fixed** formal
> element (a *"+2 Damage Attack Sword"*) from an **abstract** one (*"an incremental system that
> makes the player more powerful based on combat style — not fixed"*). This is exactly the
> tuned-content-vs-tuning-surface line the engine-tuning design targets: the `+2 sword` is an
> `engine-default` concrete value; the scaling *system* is the parametric surface.
> Feeds: `../designs/engine-tuning-support.md` (the "missing primitive").

**Telegraphed-consequence heuristic → `/lore` + `cognitive-load`/communication detection:**
flag punishment (traps, spikes, lethal mechanics) that the game does not telegraph — the player
cannot form a correct intention model. Same anti-pattern as Hopson's difficulty spike
(`secret-science-of-games.md`) and the carmack open-room ranged-stacking finding.

## MDA — Mechanics, Dynamics, Aesthetics (Hunicke, LeBlanc & Zubeck 2004)

A vocabulary for the *experience* of play, layering on FADT:
- **Mechanics** — the rules/components (what the designer authors directly).
- **Dynamics** — the run-time behavior that emerges as those rules interact with players.
- **Aesthetics** — the felt experience evoked in the player.

**The reverse-arrow (→ onboarding, capability 5):** the designer builds left-to-right
(Mechanics → Dynamics → Aesthetics); the **player experiences right-to-left** — Aesthetics
*first* (the immediate "feel" / first impression — the **on-boarding** moment; opinions form
within seconds), working backward toward the mechanics. Grounds gygax's initial-choices /
onboarding analysis: the opening must land as aesthetic/feel before the player understands the
mechanics.

**Second-order design (→ feedback loops, capability 4):** experiences *cannot be directly
designed* — they are **emergent** from the rules. The designer builds rules + scope and "lets
the player loose"; the resulting dynamics may be ones the designer never intended and cannot
fully control. Canonical example: **camping** in early FPS multiplayer emerged from *fixed*
respawn points (no one foresaw it in dev testing; fix = randomize spawns). This is exactly why
capability 4 (feedback-loop topology) matters — the *loop structure* drives emergent dynamics
that are invisible in the static content/stat blocks. "Design for the player, not for the
designer" restates the intent-vs-reality discipline.

## Where this feeds

- `../designs/engine-tuning-support.md` — FADT fixed-vs-abstract framing (missing primitive);
  MDA second-order design (capability 4 rationale); MDA reverse-arrow (capability 5 rationale).
- `/lore` — telegraphed-consequence / fair-trap heuristic; the MDA layer vocabulary.
- `/cabal` + `cognitive-load` — communication-failure detection (untelegraphed consequences).
- Construct framing — FADT's "shared formal language for analysis" is gygax's reason for being.
