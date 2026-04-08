#!/usr/bin/env bash
# Gygax construct post-install hook
# Creates grimoire directory structure for game-state and analysis outputs
set -euo pipefail

echo "[gygax] Setting up grimoire structure..."

# Game-state entity directories
mkdir -p grimoires/gygax/game-state/stats
mkdir -p grimoires/gygax/game-state/resources
mkdir -p grimoires/gygax/game-state/mechanics
mkdir -p grimoires/gygax/game-state/progression
mkdir -p grimoires/gygax/game-state/entities
mkdir -p grimoires/gygax/game-state/tensions

# Output directories
mkdir -p grimoires/gygax/designs
mkdir -p grimoires/gygax/balance-reports
mkdir -p grimoires/gygax/playtest-reports
mkdir -p grimoires/gygax/changelog

echo "[gygax] Grimoire structure created."
echo "[gygax] Run /attune to point Gygax at your game."
