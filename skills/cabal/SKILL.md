---
name: cabal
description: Scenario-based playtest simulation with 9 player archetypes and experience tracking
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
model_tier: opus
effort: large
---

# Cabal

Simulate playtesting sessions with a roster of 9 synthetic player archetypes. Each archetype represents a distinct player orientation — from the optimizer who min-maxes every mechanic to the newcomer who has never played a TTRPG before. Users compose their own panel for each run. The simulation walks each archetype through a concrete scenario beat by beat, tracking experience signals and surfacing moments where different player types have radically different experiences of the same design.

Real playtesting is expensive, slow, and hard to reproduce. Cabal provides fast, repeatable, archetype-driven analysis that catches the kinds of problems real players find — exploits, dead options, ambiguous rules, broken combos, accessibility barriers, cognitive overload, and narrative-mechanical dissonance — before those players ever sit down at the table.

This skill is **read-only** against game-state. Cabal never modifies `grimoires/gygax/game-state/`. It reads the current design, simulates how players would interact with it, and produces a playtest report with findings. Fixes go through `/homebrew`.

## Trigger

`/cabal` with optional scope and archetype flags.

Examples:
- `/cabal` -- context-aware default panel, auto-generated scenario
- `/cabal dodge-reaction` -- focused test of a specific mechanic
- `/cabal --optimizer --newcomer --gm session-arc` -- explicit panel + scenario
- `/cabal --all "first session character creation"` -- all 9 archetypes, specific scenario
- `/cabal --anxious --newcomer` -- accessibility-focused review

Also triggered by natural language:
- "playtest this"
- "stress test"
- "will players break this"
- "is this accessible to new players"
- "can a GM run this"
- "will agents game this incentive" / "red-team this reward structure"

## Incentive Red-Team Mode (`--incentives`) — cycle-006

`/cabal --incentives <incentive-state-dir>` runs the panel against an **agent system's incentive
structure** instead of a game — the archetypes become *agents* and surface the degenerate strategy
each would find. This is agent red-teaming via game-theoretic simulation (the "players" are agents;
the "exploits" are reward hacks). See `grimoires/gygax/designs/agent-incentive-analysis.md`.

**Quantitative backbone (ground the archetypes in the math, do not guess):** first run the payoff
engine and read its findings — they are the ground truth the archetypes reason from.

```bash
# single-agent reward structure → dominant strategy / spec gaming / knob recommendation
npx tsx scripts/lib/payoff/index.ts <incentive-state-dir>
# multi-agent (2-player) → coordination failure / price of anarchy
npx tsx scripts/lib/payoff/game.ts <incentive-state-dir>
```

**Archetype mapping for incentive red-team:**
- **Optimizer** → finds the dominant strategy / reward hack immediately (the payoff engine's `dominant`
  action). Reports the cheapest path to max reward regardless of intent.
- **Newcomer** → follows the reward signal naively into the same hole (confirms the hack isn't
  expert-only — it's the *default* basin).
- **Chaos Agent** → tests whether a coordination/cooperation assumption survives one defector
  (multi-agent: does the equilibrium collapse?).
- **Rules Lawyer** → probes whether the incentive's *letter* (the metric) diverges from its *intent*
  (the Goodhart gap).

**Output:** each archetype's surfaced degenerate strategy, grounded in the payoff findings, plus the
honest framing — this is a **forecast** of where the incentive *will* be gamed (model-derived), not an
observation of a live agent (agent-incentive-analysis.md §9). When the engine recommends a structural
fix (whack-a-mole), say so: penalizing one hack just moves the agents to the next.

## Observed-Trace Mode (`--observed`) — cycle-007

`/cabal --observed <batch-dir>` is the **measurement** companion to `--incentives` (which is a
*forecast*). Where `--incentives` predicts where an incentive *will* be gamed, `--observed`
reports what real agents *actually did* against a runnable task — classified from artifacts
(file diffs + a re-run of the test), never from the agent's self-report.

This mode is a **thin shell to the observed-trace seam** — no new archetype machinery. Run the
ingest and read its claim-tagged report; the report is the ground truth the panel reasons from:

```bash
# ingest a kept batch of sidecars → predicted-vs-observed diff, cliff, severity, claim tags
npx tsx scripts/lib/trace/index.ts <batch-dir-or-sidecar-dir> [--incentive-state <dir>] [--context <n>]
```

Produce the runnable batch first with the awareness-ladder harness (real agents per rung × trial):

```bash
npx tsx scripts/lib/ladder/index.ts run --fixture evals/awareness-ladder --trials 5   # spawns real agents
npx tsx scripts/lib/ladder/index.ts run --fixture evals/awareness-ladder --dry-run     # plan only, no spend
npx tsx scripts/lib/ladder/index.ts score --batch <dir>                                # re-score, no re-spawn
```

**Claim-strength discipline (carry it into every finding):** observed > simulation-derived >
forecast. An `--observed` finding is `real-agent-observed`; an `--incentives` finding is
`model-forecast`. Never blend them — the report's first line is the claim tag, always. A
**no-hack** observed run is a **finding, not a failure** ("the model's training dominated the
stated incentive"), reported as-is. See `grimoires/gygax/designs/awareness-ladder-experiment.md`
and the first run's findings in `grimoires/gygax/playtest-reports/awareness-ladder-2026-06-09.md`.

## Revealed-Strategy Mode (`--observed --strategy`) — cycle-012

`/cabal --observed --strategy <corpus-dir>` is the **strategy-axis** companion to `--observed` (which
classifies reward-hacking). Where `--observed` asks *did an agent cheat the metric*, `--strategy` asks
*of the choices the design offers, which does real play reveal as live — and which collapse to one
dominant line wearing a costume?* It is the **Reality Plane for the decision axis** (evolution-roadmap
§4): it validates the forecast **Decision Point Map** (Step 2.7d) against how strong players actually choose.

This mode is a **thin shell to the trace seam** — no new archetype machinery. Run the lens and read its
claim-tagged report; fold its **Revealed Strategy** section into the playtest report beside the Decision
Point Map:

```bash
# corpus → revealed preference → reconcile vs forecast (+ optional candidate policy) → claim-tagged report
npx tsx scripts/lib/trace/strategy.ts <corpus-dir> [--forecast <dpm.json>] [--policy <policy.json>] [--n-floor <n>]
```

**Inputs:**
- `<corpus-dir>` — a directory of **decision-trace/v1** records (`schemas/decision-trace.v1.schema.json`):
  one record per decision, `{context.segment, offered[], chosen[]}`. Source-agnostic (found telemetry, a
  real-agent batch, or a sim); the producer kind **binds the claim strength** (a simulation may not tag
  itself observed).
- `--forecast <dpm.json>` (optional) — the Decision Point Map as `{points:[{call: dominant|false-choice|
  balanced, options:[…]}], claim:"model-forecast"}`. Reconciliation reports **confirmed / missed
  false-choice / over-called dominant**.
- `--policy <policy.json>` (optional) — a candidate ordering `{id, ordering:[…]}`; the report ranks its
  largest **rank divergences** vs observed play.

**Claim discipline (carry it into every finding):** observed > simulation-derived > model-forecast. The
observed ordering is from real play; the forecast and candidate-policy lines are `model-forecast` and are
**never blended** into it. **Revealed ≠ optimal:** the lens reports the empirical equilibrium of the
corpus, not a proof of best play (calling it optimal is the intransitive engine's job). A **no-divergence**
result is a finding, not a failure. Small samples (`n < --n-floor`, default 5) are tagged *within-noise*
and assert no direction. The **Optimizer** archetype may cite the *observed* dominant line instead of
forecasting one. Design + golden fixture: `grimoires/gygax/designs/revealed-strategy-lens.md`,
`scripts/lib/trace/__fixtures__/ptcg-revealed/`.

## Archetype Roster

9 archetypes, each testing a distinct dimension of the design. Full behavioral profiles with per-tradition weightings are in `skills/cabal/resources/archetypes.yaml`.

| Archetype | Flag | Motivation | Tests For |
|-----------|------|-----------|-----------|
| **Optimizer** | `--optimizer` | Win within the rules. Maximize output. | Dominant strategies, exploits, trap options, scaling breaks |
| **Explorer** | `--explorer` | See everything. Test the edges. | Dead design space, edge cases, breadth, accessibility |
| **Storyteller** | `--storyteller` | Create compelling narrative. | Fiction-mechanics alignment, dramatic inertia, feel-bad moments |
| **Rules Lawyer** | `--rules-lawyer` | Expose every ambiguity. | RAW vs RAI, contradictions, undefined states, scope creep |
| **Newcomer** | `--newcomer` | First TTRPG ever. No conventions. | Accessibility, onboarding friction, jargon, self-teaching |
| **Chaos Agent** | `--chaos-agent` | Go off-script. "I befriend the monster." | Graceful degradation, GM improvisation load, uncovered actions |
| **GM** | `--gm` | Run the game behind the screen. | Cognitive load, prep needs, improvisation space, spotlight |
| **Anxious Player** | `--anxious` | Overwhelmed by choices, afraid of mistakes. | Decision paralysis, failure harshness, recovery, option overload |
| **Veteran** | `--veteran` | 50+ sessions deep. Seeks sustained depth. | Long-term engagement, mastery plateau, emergent complexity |

**For non-traditional games**: Archetypes adapt to ANY game. In a journaling RPG, the Optimizer finds prompt sequences that produce the most dramatic entries. In a GMless game, the Rules Lawyer probes authority distribution. If an archetype genuinely cannot engage (e.g., Optimizer in a game with no mechanical choices), report that explicitly -- "The Optimizer has nothing to optimize, which may indicate the game lacks mechanical depth for players who want it" -- that IS a finding.

### Custom Archetypes (cycle-011, FR-2)

The 9 built-ins are fixed, but designers can **extend** the roster with their own player archetypes —
"The Speedrunner", "The Lapsed Veteran", "The Backseat Optimizer" — without editing the built-ins.

- **Where:** one archetype per file in `grimoires/gygax/archetypes/<id>.yaml`. A worked example ships
  at `grimoires/gygax/archetypes/speedrunner.yaml`.
- **Shape:** identical to a built-in (`id, name, description, motivation, blind_spots[], tests_for[]
  {severity, category, description}, behavioral_weightings{default, …}`). The structural contract is
  `scripts/lib/archetypes/schema.yaml`, derived verbatim from the built-ins.
- **Validate before use:**
  ```bash
  tsx scripts/lib/archetypes/validate.ts grimoires/gygax/archetypes/speedrunner.yaml   # one file
  tsx scripts/lib/archetypes/validate.ts                                               # whole roster + merge
  ```
  Exit 0 = valid; exit 1 = a field-level error (`<file>: <field path> — <expected vs found>`).
- **Rules:** the `id` is kebab-case and must **not collide** with a built-in or another user file —
  collisions are **rejected loud**, never silently shadowed. An invalid file is **excluded** from the
  panel and **reported**, never silently dropped.
- **Selection:** a valid user archetype is selectable by its id flag (e.g. `--speedrunner`) and is
  included in `--all`, exactly like a built-in.

## Panel Selection

### User-Composed Panels

Users select archetypes via flags:

```
/cabal --optimizer --newcomer --gm     # These 3 only
/cabal --all                           # All 9
/cabal --all --no-veteran              # All except Veteran
```

### Context-Aware Defaults

When no flags are provided, Cabal selects a panel based on what's being tested:

| Scenario Type | Default Panel | Rationale |
|---------------|--------------|-----------|
| New mechanic | Optimizer, Rules Lawyer, Newcomer | Exploitable? Clear? Accessible? |
| Combat encounter | Optimizer, Storyteller, GM | Efficient? Dramatic? Runnable? |
| Session arc | Optimizer, Storyteller, Newcomer, GM, Veteran | Broad coverage across session length |
| Character creation | Explorer, Anxious Player, Newcomer | Breadth? Overwhelming? Accessible? |
| Specific entity (class/playbook) | Optimizer, Explorer, Veteran | Build depth, options, sustained engagement |
| Full game review | All 9 | Comprehensive |

The panel selection and rationale are documented in every report header.

## Workflow

### Step 1: Load Game-State and Previous Reports

1. Check that `grimoires/gygax/game-state/index.yaml` exists. If not: "No game attuned yet. Run `/attune` first."
2. Read `index.yaml` for the full entity manifest, graph integrity, and **design parameters**.
3. Load archetype definitions from `skills/cabal/resources/archetypes.yaml`. **Then merge any custom archetypes** from `grimoires/gygax/archetypes/` by running `tsx scripts/lib/archetypes/validate.ts` — valid user archetypes join the selectable roster; invalid or id-colliding files are excluded and their errors surfaced to the user (never silently dropped). Adjust behavioral weightings based on the game's tradition.
4. Glob `grimoires/gygax/playtest-reports/*.md` for previous reports. Read them for regression baseline.
5. If first run, note: "No regression baseline."
6. Read `design_parameters` from `index.yaml`. Use for panel selection weighting (Step 2) and signal sensitivity (Step 5).

### Step 2: Assemble Panel

1. Parse archetype flags from invocation. If explicit flags, use those.
2. If no flags, determine scenario type from the invocation and select context-aware default panel (see table above).
3. **Design parameter weighting (v3.1):**
   - `target_audience: newcomer` → always include Newcomer and Anxious Player in the panel, even if not in the context-aware default. Weight their signals higher in the findings summary.
   - `target_audience: mastery` → always include Optimizer and Veteran. Weight Newcomer signals lower.
   - `target_session_length: short` → weight pacing-related signals (Dead time, Decision paralysis) higher.
   - `target_player_count: large` → always include GM. Weight Cognitive overload signals higher.
   - `target_interaction: cooperative` → model archetypes as allies. Optimizer optimizes group outcome, not personal advantage. Chaos Agent tests what happens when someone breaks coordination.
   - `target_interaction: solo` → single-archetype runs only. Test the game from one player's perspective at a time.
   - `target_randomness: none` → weight Decision paralysis and Mastery reward signals higher (deterministic games live or die on decision quality).
4. State the panel selection in the output: "Panel: Optimizer, Rules Lawyer, Newcomer (selected for new mechanic review; Newcomer/Anxious added per design_parameters.target_audience: newcomer)"

### Step 2.5: Read Intent

Before running the walkthrough, read `intent` fields from all in-scope entities:
- Every tension (required to have intent)
- Every mechanic with intent set
- The dungeon's intent (if scope includes dungeons)

Build an "intent context" the archetypes can reference during the walkthrough. An archetype seeing an asymmetric mechanic should know whether that asymmetry is designer-intended.

### Step 2.7: Structural Pre-Pass (v3.1)

Before constructing scenarios or running walkthroughs, perform a structural analysis of the game-state to ground archetype reasoning in concrete data. This pre-pass produces data that archetypes reference in their "sees" and "chooses" reasoning.

**2.7a: Graph Traversal**

1. Identify the scenario's target entities (the mechanic, encounter, or system being tested).
2. Walk the dependency graph 2 hops in each direction from each target entity.
3. Build a local entity map with depth annotations (how many hops from the target).
4. For stub entities in the map, note: `[STUB — no structural data available]`.

**2.7b: Probability Snapshot**

For each mechanic in the entity map that has a `resolution` field:
1. Determine the dice system from `resolution.method`.
2. Invoke the appropriate probability script (using the same script decision matrix as `/augury` — see `scripts/MANIFEST.yaml`):
   - d20 roll → `dice-probability.ts`
   - 2d6/3d6 sum → `bell-curve.ts`
   - Dice pool → `dice-pool.ts`
   - Advantage/disadvantage → `advantage.ts`
   - Exploding dice → `exploding-dice.ts`
3. Store for each mechanic: P(success), P(failure), P(special outcomes), expected value, variance.
4. For mechanics without explicit resolution (narrative triggers, GM fiat): note `[no-probability — prompt-driven analysis]`.
5. **Non-dice resolution methods (v4):** For mechanics with resolution methods like `worker-placement`, `auction`, `drafting`, `simultaneous-choice`, `deterministic`, or `automated`, produce a **decision-space snapshot** instead of probability data:
   - `worker-placement` / `drafting`: slot count, contention ratio, pick-order advantage
   - `auction` / `negotiation`: estimated value range, information advantage assessment
   - `simultaneous-choice`: option count, dominant strategy (if detectable)
   - `deterministic` / `automated`: input dimensionality, optimization surface description
   - `deduction`: information sufficiency, solvability assessment
   - Other non-dice: decision space size, qualitative assessment, tagged `[structural — no probability data]`

**2.7c: Resource Pressure Map**

For each resource in the entity map:
1. Identify all mechanics in the map that consume this resource (via `cost` fields).
2. Estimate depletion rate: cost per use × expected uses per scenario scope.
3. Estimate recovery rate: recovery amount × recovery trigger frequency per scenario scope.
4. Compute net pressure = depletion rate − recovery rate.
5. Flag resources where:
   - Net pressure is strongly positive → **draining** (resource will run out during scenario)
   - Net pressure is strongly negative → **surplus** (resource never creates meaningful tension)
   - Net pressure is near zero → **balanced**

**2.7d: Decision Point Map**

For each mechanic in the entity map that involves a player-facing choice:
1. List available options at the decision point.
2. For each option: expected outcome (from probability snapshot), resource cost (from entity `cost` field), downstream consequences (walk `affects` from the mechanic).
3. Flag:
   - **Dominant option**: one option is strictly better than all others (higher success rate AND lower cost AND no worse consequences)
   - **False choice**: two+ options resolve to identical outcomes
   - **Information-hidden choice**: outcome depends on unknowns the player can't assess

### Step 3: Construct Scenario

Parse the user's invocation to determine the scenario.

**If user provided a scenario**: Parse it. Identify the temporal scale:
- **Moment**: A single mechanic activation or decision point
- **Encounter**: A complete combat, social encounter, or exploration scene
- **Session**: A full session arc (opening → escalation → climax → wind-down)
- **Campaign arc**: Character progression across multiple sessions

**If no scenario provided**: Auto-generate from game-state:
1. Read `index.yaml` dependency graph. Identify the most interconnected mechanics (`most_depended_on`).
2. Construct a representative scenario that exercises those mechanics at the appropriate scale.
3. For scoped invocations (`/cabal dodge-reaction`), build the scenario around that specific mechanic.

**Decompose into beats**: Break the scenario into discrete decision points or events. Each beat is a moment where an archetype must perceive, choose, and experience an outcome.

### Step 4: Run Walkthrough

For each archetype in the panel, walk through the scenario beat by beat.

At each beat, document:

```
Beat N: [situation description]
  {Archetype} sees: [perception given their orientation and experience level]
  {Archetype} chooses: [action and reasoning]
  Resolution: [mechanical outcome]
  Experience signal: [one of the 8 signals]
  Signal rationale: [why this signal, grounded in specific game-state entities]
```

When an archetype encounters an entity with stated intent, the archetype's 'Chooses' reasoning can reference intent. The Optimizer might note: 'The asymmetry is flagged as deliberate per intent — the designer wants this inversion. I'll play into it rather than against it.' Experience signals remain purely experiential — intent does not change whether the Newcomer is confused.

**Walkthrough guidelines:**
- Be concrete. Reference specific game-state entity values, not abstractions.
- Each archetype's "sees" should reflect their actual knowledge level. The Newcomer does not know what "action economy" means. The Veteran knows every interaction.
- Each archetype's "chooses" should follow their behavioral weightings. The Optimizer picks the mathematically best option. The Chaos Agent does something unexpected.
- Resolution uses the actual mechanics from game-state. Roll outcomes, resource costs, consequences.
- Every beat gets exactly one experience signal per archetype.

**Structural grounding (v3.1):**
Archetypes MUST reference pre-pass data when available:
- **Optimizer** cites success rates from probability snapshot. Example: "Resolution has 50.0% success at DOSE 4 (dice-probability.ts). Words resource has surplus pressure (-1.5/scene). Optimal play: spend words aggressively."
- **Newcomer** cites graph depth and entity count. Example: "This decision requires understanding 3 connected entities (dose → resolution → crossroads). No fallback in dependency chain."
- **GM** cites simultaneous state tracking from the entity map. Example: "At this beat, GM tracks: DOSE threshold per PC, CROSSROADS counter, scene timer, word pool — 4 concurrent states."
- **Optimizer/Rules Lawyer** cite dominant options or false choices from decision point map.
- When pre-pass data is not available for a particular beat (narrative-only moment, no mechanics engaged), archetypes reason from prompt context and the signal is tagged accordingly.

### Step 5: Track Experience Signals

Each signal has concrete, mechanically-grounded triggers:

| Signal | Triggers When | Most Sensitive Archetypes |
|--------|--------------|--------------------------|
| **Confusion** | Mechanic references undefined concepts, uses unexplained jargon, has ambiguous trigger conditions, or requires knowledge the archetype does not have | Newcomer, Anxious Player |
| **Excitement** | Resolution produces a dramatic outcome, a combo works as hoped, fiction reaches a peak moment, or a meaningful choice pays off | Storyteller, Veteran |
| **Dead time** | No meaningful action available, turn produces no impact, waiting for other archetypes, or mechanic is irrelevant to this archetype | Explorer, Veteran |
| **Decision paralysis** | More than 5 viable options with unclear relative value, consequences of failure are severe and unclear, or no guidance on what a "good" choice looks like | Anxious Player, Newcomer |
| **Frustration** | Optimal play is obvious but boring, thematically appropriate action is mechanically punished, system feels unfair, or effort is not rewarded | Optimizer, Rules Lawyer |
| **Cool moment** | Emergent interaction produces something unplanned, system and fiction align to create a memorable beat, or mastery creates an unexpectedly satisfying outcome | Storyteller, Explorer, Veteran |
| **Cognitive overload** | More than 3 active mechanical states to track simultaneously, resolution requires consulting multiple subsystems, or too many things happening at once to process | GM, Newcomer |
| **Mastery reward** | A non-obvious mechanical choice produces a meaningfully better outcome than the obvious choice, or deep system knowledge creates an advantage | Optimizer, Veteran |

Experience signals are NEVER suppressed by intent. If the Newcomer is confused, that's a real UX problem regardless of whether the confusion-causing mechanic is intentional. Intent changes finding severity, not experience signal presence.

**Signal rules:**
- Every beat gets exactly one signal per archetype.
- Signals must be grounded: "Confusion because DOSE threshold is referenced but never explained in the mechanic description" -- not "this seems confusing."
- If no strong signal applies, use the one closest to the archetype's experience at that moment.

**Signal citation requirements (v3.1):**
- When a signal can be supported by pre-pass data, cite it and tag `[structurally-grounded]`. Example: `"Confusion [structurally-grounded]: resolution requires cross-referencing dose (stats/) → resolution (mechanics/) → crossroads (mechanics/) [graph depth: 3, no fallback mechanic in dependency chain]"`
- When a signal is based on narrative judgment rather than structural data, tag `[prompt-grounded]`. Example: `"Excitement [prompt-grounded]: the fiction reaches a dramatic peak as the character's identity inverts"`
- Target: at least 50% of signals in a report should be `[structurally-grounded]`. If this threshold isn't met, note it in the report methodology section.
- Both tag types are valid findings — structural grounding adds precision, not legitimacy.

### Step 6: Detect Experience Divergence

After all archetypes complete the walkthrough, cross-compare signals at each beat.

**Flag divergence when:**
- Two or more archetypes have opposite signals at the same beat (e.g., Optimizer: Excitement, Newcomer: Confusion)
- One archetype has Dead time while 2+ others are actively engaged
- The GM has Cognitive overload while players have Excitement
- An archetype meant to enjoy this scenario (based on panel selection rationale) is experiencing Frustration or Confusion

**Divergence severity:**
- **HIGH**: Opposite signals between archetypes (Excitement vs. Confusion, Mastery reward vs. Decision paralysis)
- **MEDIUM**: One archetype disengaged while others are engaged (Dead time vs. anything active)
- **LOW**: Same general valence but different intensity

**Divergence findings** are a first-class output. They represent invisible fractures in the design -- problems that only emerge when you compare across player types.

Experience divergence findings are ALSO never suppressed by intent. A design that serves the Optimizer while drowning the Newcomer is a real fracture in the design, whether intentional or not. Intent context in the report explains whether the gap is 'designed for' (and thus a tradeoff the designer accepted) or 'unplanned' (and thus likely a bug).

### Step 7: Regression Check

Compare current findings against previous playtest reports.

1. For each finding in previous reports, check: does the current game-state still exhibit this issue?
2. Classify each previous finding as:
   - **Resolved**: The issue no longer exists
   - **Persists**: The issue still exists unchanged
   - **Worsened**: Subsequent changes made the issue more severe
   - **Evolved**: The issue has changed character

### Step 7.5: Apply Intent to Finding Classification

For each finding from any archetype:

1. Check if the entity involved has intent set
2. If intent exists and the finding aligns with intent:
   - Tag as [INTENT-ALIGNED]
   - If severity was Warning → Observation ("working as designed per intent")
   - If severity was Critical → Still Critical (math cannot be intentionally broken)
   - If severity was Non-obvious → Still Non-obvious, with [INTENT-ALIGNED] tag
3. If intent exists and the finding conflicts with intent:
   - Tag as [INTENT-CONFLICT]
   - Severity UNCHANGED (intent-conflict is valuable context, not a suppression)
   - Recommendation cites: "This mechanic's intent was '[summary]' — consider whether the current implementation serves that intent"
4. If non_negotiable: true on intent:
   - Warning findings SUPPRESSED (moved to appendix, not main findings)
   - Still appear in "Suppressed by Non-Negotiable Intent" appendix for transparency

If entity has no intent:
   - Leave finding classification unchanged
   - Add note in report: "N entities have no intent set. Future runs will have richer context once intent is captured via /homebrew --set-intent"

### Step 8: Generate Report

Write to `grimoires/gygax/playtest-reports/YYYY-MM-DD-scope-description.md`.

## Report Format

```markdown
# Playtest Report: [Scope Description]

**Date:** YYYY-MM-DD
**Game:** [Game Name] ([tradition])
**Game-State Version:** [last_modified_at from index.yaml] | [entity count] entities | [changes since last playtest, if any]
**Panel:** [archetype list] -- [selection rationale]
**Scenario:** [description] ([scale: moment|encounter|session|campaign-arc])
**Entities Tested:** [count]
**Previous Reports:** [count] (or "None -- first run")
**Design Parameters:** [active parameters, or "not set (tradition defaults)"]

## Executive Summary

[2-4 sentences: what was tested, most important finding, overall health.]

## Scenario Analysis (v3.1)

Data from the structural pre-pass (Step 2.7). This is what the archetypes are reasoning from.

### Entity Graph
Target: [target entity path]
Connected entities (2-hop): [list with graph paths]

### Probability Snapshot
| Mechanic | System | P(success) | P(failure) | P(special) | Source |
|----------|--------|------------|------------|------------|--------|
| [name] | [dice system] | X% | Y% | Z% | [script name + input] |

### Resource Pressure
| Resource | Depletion/scope | Recovery/scope | Net Pressure | Rating |
|----------|----------------|----------------|--------------|--------|
| [name] | X | Y | Z | draining/surplus/balanced |

### Decision Points
| Decision | Options | Dominant? | Notes |
|----------|---------|-----------|-------|
| [description] | [count] | [yes/no/situational] | [key observation] |

[Tables may be empty or abbreviated for simple games. Omit tables with no data.]

## Scenario

[The scenario broken into beats with fiction and mechanical context.]

### Beat 1: [description]
[Situation, stakes, available actions]

### Beat 2: [description]
...

## Walkthrough: [Archetype Name]

### Approach
[1-2 sentences: how this archetype engaged with the scenario.]

### Beat-by-Beat

| Beat | Sees | Chooses | Outcome | Experience |
|------|------|---------|---------|------------|
| 1 | [perception] | [action + reasoning] | [resolution] | Excitement |
| 2 | [perception] | [action + reasoning] | [resolution] | Confusion |
| ... | | | | |

### Findings

[Standard format per finding:]
[ARCHETYPE] [SEVERITY]: One-line summary
  Description: Full description
  Voice: [In-character one-liner from this archetype's perspective — make the finding vivid]
  Evidence: Specific game-state entities and values
  Recommendation: Suggested next step (which skill, what question)

[Repeat ## Walkthrough section for each archetype in panel]

## Promise Delivery

[Does the game deliver on its own pitch? Read the game's description from index.yaml and evaluate whether the mechanics actually produce the experience the game claims to offer.]

**The game says:** "[description from index.yaml]"
**The mechanics deliver:** [Yes/Partially/No] — [Specific evidence from the walkthrough. Which beats fulfilled the promise? Which didn't? Is there a gap between what the game claims and what the system produces?]

## Rules Clarity

[Standalone section listing every ambiguity, undefined term, jargon assumption, and "I had to guess" moment encountered across ALL archetypes during the walkthrough. Organized by severity.]

| # | Rule/Mechanic | Issue | Who Hit It | Severity |
|---|--------------|-------|-----------|----------|
| 1 | [mechanic] | [what's unclear] | [which archetypes] | High/Medium/Low |

[This section consolidates clarity issues that may be scattered across individual archetype findings. A designer should be able to read this section alone and know every place their rules text needs work.]

## Session Energy

[Beat-by-beat engagement map across the panel. Shows where the session peaked and where it dragged.]

| Beat | Description | [Archetype A] | [Archetype B] | [Archetype C] | Overall |
|------|-------------|------|------|------|---------|
| 1 | [beat summary] | [signal] | [signal] | [signal] | [HIGH/MEDIUM/LOW] |
| 2 | ... | ... | ... | ... | ... |

[Identify: Where was the energy peak? Where was the energy trough? Is the arc shape intentional?]

## Experience Divergence

Moments where archetypes had radically different experiences of the same design.

| Beat | [Archetype A] | [Archetype B] | [Archetype C] | Divergence |
|------|---------------|---------------|---------------|------------|
| 2 | Excitement | Confusion | Dead time | HIGH |
| 5 | Mastery reward | Decision paralysis | -- | MEDIUM |

### Analysis

[What the divergence means for the design. Which player types are being served well vs. poorly. Specific game-state entities that cause the divergence.]

## Intent Alignment

[Summary of how findings relate to stated intent:]

**Entities with intent set:** N of M
**Findings aligned with intent:** N (tagged [INTENT-ALIGNED])
**Findings in conflict with intent:** N (tagged [INTENT-CONFLICT])
**Findings suppressed (non-negotiable intent):** N (see appendix)

### Findings by Intent Relationship

| Entity | Intent Summary | Aligned | Conflicting |
|--------|---------------|---------|-------------|
| ... | ... | count | count |

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | N |
| Major | N |
| Minor | N |
| Observation | N |
| Non-obvious | N |
| Divergence | N |

## Regression Check

[If previous reports exist:]
| Previous Finding | Status | Notes |
|-----------------|--------|-------|
| [finding] | Resolved / Persists / Worsened / Evolved | [explanation] |

[If no previous reports:]
First cabal run. No regression baseline established.

## Recommended Next Steps

[Cross-skill chaining: specific invocations tied to findings.]
- `/homebrew [mechanic]` -- to address [finding #N]
- `/augury [mechanic]` -- to quantify [finding #N]
- `/lore [topic]` -- to check [finding #N] against known patterns
- `/cabal [narrower scope]` -- to investigate [finding #N] more deeply
- `/scry "[proposed change]"` -- to explore a fix before committing

[Each recommendation must include the exact invocation and reference a specific finding number.]
```

## Tradition Adaptation

Archetype behavior shifts based on the game's tradition. The same archetype asks different questions in different design contexts. Per-tradition behavioral weightings are defined in `skills/cabal/resources/archetypes.yaml` for all 9 archetypes.

**For custom tradition**: Archetypes adapt based on what the game actually does, not what any standard tradition assumes. A custom game's core loop determines which archetypes have the most to contribute. If the game's core loop is "draw prompt, write, reflect" (journaling RPG), the GM archetype may have nothing to test -- that itself is a finding about the game's design scope.

## Boundaries

- Does NOT modify game-state files -- Cabal is strictly read-only against `grimoires/gygax/game-state/` (use `/homebrew` to implement fixes)
- Does NOT design new mechanics (use `/homebrew` for that)
- Does NOT perform isolated numerical analysis (use `/augury` for that)
- Does NOT ingest source material (use `/attune` for that)
- Does NOT apply tradition heuristic libraries (use `/lore` for that)
- Does NOT replace real playtesting -- Cabal catches structural issues but cannot simulate social dynamics, table culture, or spontaneous creativity
- Does NOT produce definitive verdicts -- findings are hypotheses for the designer to evaluate
- DOES simulate 9 distinct player orientations with scenario-based walkthroughs
- DOES track experience signals per archetype per beat
- DOES detect experience divergence across archetypes
- DOES check for regressions against previous playtest runs
- DOES adapt archetype behavior to the game's tradition
- DOES guarantee at least one non-obvious finding per run
- DOES read entity intent and adjust finding classification accordingly
- Does NOT suppress experience signals or divergence findings based on intent (these are experiential, not judgment-based)
- Does NOT edit files in `.claude/` (System Zone)

## Output

| Artifact | Path | Format |
|----------|------|--------|
| Playtest report | `grimoires/gygax/playtest-reports/YYYY-MM-DD-scope-description.md` | Markdown (report format above) |

Reports accumulate over time. Each run adds a new report. Previous reports are never overwritten -- they form the regression baseline.

## Error Handling

| Error | Response | Recovery |
|-------|----------|----------|
| No game-state exists | "No game attuned yet. Run `/attune` first to build your game-state." | Redirect to `/attune` |
| Invalid archetype flag | "Unknown archetype `--foo`. Available: --optimizer, --explorer, --storyteller, --rules-lawyer, --newcomer, --chaos-agent, --gm, --anxious, --veteran, --all" | Show available flags |
| Scoped entity not found | "I can't find `[id]` in game-state. Here's what exists: [list]. Did you mean one of these?" | Offer alternatives |
| Game-state too sparse | "Game-state only has [N] entities. Cabal works best with at least stats, resources, and core mechanics. Run `/attune` to add more, or provide a specific scenario." | Proceed with caveats |
| No findings at non-obvious severity | Dig deeper. Re-examine cross-archetype divergence, second-order effects, pacing implications. A cabal run without a non-obvious finding has not looked hard enough. | Mandatory re-analysis |
| Previous report references removed entities | Note removal in regression check: "Resolved (entity removed from game-state)" | Document in regression section |
| Archetype cannot engage with game | Report that explicitly: "The [Archetype] has nothing to [action] -- this may indicate the game lacks [dimension] for players who want it." | This IS a finding |
