# Evaluation Harness

Benchmark suite of known game design failures with expected detections. Used to verify that changes to Gygax's analysis skills don't regress detection quality.

## Structure

```
evals/
  fixtures/           # One subdirectory per failure archetype
    {archetype}/
      game-state/     # Valid game-state YAML encoding the failure
        index.yaml
        stats/...
        mechanics/...
      manifest.yaml   # Fixture metadata
  expected/           # Expected findings per fixture
    {archetype}.yaml
  harness.sh          # Structural validation runner
```

## Adding a Fixture

1. Create `evals/fixtures/{archetype}/game-state/` with valid game-state YAML that encodes a specific, documented failure pattern.
2. Create `evals/fixtures/{archetype}/manifest.yaml` with fixture metadata.
3. Create `evals/expected/{archetype}.yaml` with expected findings.
4. Run `bash evals/harness.sh --structural` to validate.

## Manifest Schema

```yaml
id: kebab-case-archetype-name
name: "Human-readable failure name"
failure_archetype: scaling-failure|economic-collapse|design-trap|mad-dependency|proactive-reactive|degenerate-strategy|safety-net-weapon|cognitive-overload|pacing-slog|communication-failure
tradition: d20|pbta|fitd|osr|cepheus|freeform|custom
description: |
  What failure pattern this encodes and why it's a known problem.
source: "Citation to real-world documentation of this failure"
tests_skills:
  - augury (layer name)
  - cabal (archetype name)
  - lore
design_parameters:
  target_session_length: medium
  target_audience: intermediate
  # ... any relevant parameters
```

## Expected Findings Schema

```yaml
fixture: archetype-name
expected_findings:
  - skill: augury|cabal|lore
    layer: resolution|action-economy|resource-economy|progression|pacing|cognitive-load  # augury only
    severity: Critical|Warning
    category: failure-pattern-name
    description_contains: "substring that must appear in finding description"
    entity_refs:                    # optional: entities that should be referenced
      - path/to/entity.yaml

  - skill: cabal
    signal: confusion|excitement|dead-time|decision-paralysis|frustration|cool-moment|cognitive-overload|mastery-reward
    archetype: Optimizer|Explorer|Storyteller|Rules Lawyer|Newcomer|Chaos Agent|GM|Anxious Player|Veteran
    description_contains: "substring"

  - skill: cabal
    divergence: true                # expect experience divergence to be flagged
    description_contains: "substring"

expected_absent:                    # things that should NOT be flagged
  - skill: augury
    layer: resolution
    severity: Critical
    reason: "Why this should not be flagged"
```

## Running the Harness

```bash
# Structural validation (CI gate — no AI invocation)
bash evals/harness.sh --structural

# Validates:
# - All fixtures have valid YAML
# - All manifests have required fields
# - All expected findings reference valid skills/layers/archetypes/signals
# - No fixture has zero expected findings
# - All entity_refs in expected findings point to files that exist in the fixture's game-state
```

## Failure Archetypes

| Archetype | Source | Key Detection |
|-----------|--------|---------------|
| scaling-failure | D&D 3.x martial/caster | augury: progression layer |
| economic-collapse | Ultima Online | augury: resource-economy layer |
| design-trap | D&D 3.x Toughness feat | augury: progression layer + cabal: Newcomer |
| mad-dependency | D&D 3.x Monk | augury: progression layer |
| proactive-reactive | D&D 3.x CoDzilla | augury: action-economy layer |
| degenerate-strategy | MtG Combo Winter | cabal: Optimizer |
| safety-net-weapon | MtG Mulligan exploit | augury + lore |
| cognitive-overload | Fall from Heaven | augury: cognitive-load layer + cabal: Newcomer |
| pacing-slog | Fall from Heaven | augury: pacing layer |
| communication-failure | Fall from Heaven | cabal: Newcomer + Anxious Player |

Source: `grimoires/gygax/references/design-failure-postmortem.md`
