---
name: attune
description: Onboard and ingest a TTRPG system, rulebook, or game reference into Gygax
user-invocable: true
allowed-tools: Read, Write, Glob, Grep, Edit, Bash
---

# Attune

Onboard and ingest a TTRPG system, rulebook, or game reference into the Gygax construct. This skill reads source material, extracts core mechanics, and produces structured grimoire artifacts that other skills can reference.

## Trigger

/attune

## Workflow

Placeholder -- full workflow defined in a later sprint.

## Boundaries

- Does NOT design new mechanics (use /homebrew for that)
- Does NOT evaluate balance (use /augury for that)
- Does NOT simulate play (use /cabal for that)
- Focuses solely on accurate extraction and representation of existing game content

## Output

Artifacts are written to grimoires/gygax/attune/.
