#!/usr/bin/env bash
# Gygax — standalone installer for Claude Code (no Loa required)
# Usage: curl -fsSL https://raw.githubusercontent.com/0xHoneyJar/construct-gygax/main/install.sh | bash
set -euo pipefail

REPO="0xHoneyJar/construct-gygax"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[gygax]${NC} $*"; }
warn() { echo -e "${YELLOW}[gygax]${NC} $*"; }

# Check if we're in a project directory
if [[ ! -d ".git" ]] && [[ ! -f "CLAUDE.md" ]] && [[ ! -d ".claude" ]]; then
  warn "No project detected (no .git, CLAUDE.md, or .claude/)."
  warn "Run this from your project root."
  exit 1
fi

log "Installing Gygax into $(basename "$(pwd)")..."

# Create .claude/skills directories
SKILLS=(attune homebrew augury cabal lore gygax-status scry delve)
for skill in "${SKILLS[@]}"; do
  mkdir -p ".claude/skills/$skill"
done

# Download skill files
log "Downloading skills..."
for skill in "${SKILLS[@]}"; do
  curl -fsSL "$BASE_URL/skills/$skill/SKILL.md" -o ".claude/skills/$skill/SKILL.md"
  curl -fsSL "$BASE_URL/skills/$skill/index.yaml" -o ".claude/skills/$skill/index.yaml"
done

# Download skill resources
log "Downloading resources..."
mkdir -p ".claude/skills/attune/resources"
curl -fsSL "$BASE_URL/skills/attune/resources/game-state-schema.md" -o ".claude/skills/attune/resources/game-state-schema.md"

mkdir -p ".claude/skills/cabal/resources"
curl -fsSL "$BASE_URL/skills/cabal/resources/archetypes.yaml" -o ".claude/skills/cabal/resources/archetypes.yaml"

mkdir -p ".claude/skills/lore/resources"
for tradition in d20 pbta fitd osr cepheus autobattler roguelike deckbuilder ccg 4x tactics eurogame social-deduction cooperative idle extraction looter immersive-sim; do
  curl -fsSL "$BASE_URL/skills/lore/resources/$tradition.yaml" -o ".claude/skills/lore/resources/$tradition.yaml"
done

# Download identity files
log "Downloading identity..."
mkdir -p "identity"
curl -fsSL "$BASE_URL/identity/persona.yaml" -o "identity/persona.yaml"
curl -fsSL "$BASE_URL/identity/expertise.yaml" -o "identity/expertise.yaml"
mkdir -p ".claude/gygax"
curl -fsSL "$BASE_URL/CLAUDE.md" -o ".claude/gygax/CLAUDE.md"

# Download probability scripts (required by /augury and /delve)
log "Downloading probability scripts..."
mkdir -p "scripts/lib"
for script in dice-probability bell-curve dice-pool advantage exploding-dice cdf-compare construct-runtime; do
  curl -fsSL "$BASE_URL/scripts/lib/$script.ts" -o "scripts/lib/$script.ts"
done

# Download reference game-states (required by /attune --reference and /augury compare)
log "Downloading reference game-states..."
for ref_system in 5e-srd pbta-baseline cepheus-core; do
  # Fetch the file list from the repo's index.yaml to know what to download
  ref_base=".claude/skills/attune/resources/references/$ref_system"
  mkdir -p "$ref_base/game-state/stats" "$ref_base/game-state/resources" \
           "$ref_base/game-state/mechanics" "$ref_base/game-state/progression" \
           "$ref_base/game-state/entities" "$ref_base/game-state/tensions"
  curl -fsSL "$BASE_URL/skills/attune/resources/references/$ref_system/metadata.yaml" \
    -o "$ref_base/metadata.yaml"
  curl -fsSL "$BASE_URL/skills/attune/resources/references/$ref_system/game-state/index.yaml" \
    -o "$ref_base/game-state/index.yaml"
  # Parse file paths from index.yaml and download each entity
  grep "  - path:" "$ref_base/game-state/index.yaml" 2>/dev/null | awk '{print $3}' | while read -r entity_path; do
    entity_dir=$(dirname "$entity_path")
    mkdir -p "$ref_base/game-state/$entity_dir"
    curl -fsSL "$BASE_URL/skills/attune/resources/references/$ref_system/game-state/$entity_path" \
      -o "$ref_base/game-state/$entity_path"
  done
done

# Download design-failure reference document (used by eval harness and analysis context)
log "Downloading reference documents..."
curl -fsSL "$BASE_URL/grimoires/gygax/references/design-failure-postmortem.md" \
  -o "grimoires/gygax/references/design-failure-postmortem.md"

# Create grimoire structure
log "Creating grimoire structure..."
mkdir -p grimoires/gygax/game-state/{stats,resources,mechanics,progression,entities,tensions}
mkdir -p grimoires/gygax/{designs,balance-reports,playtest-reports,changelog}
mkdir -p grimoires/gygax/{lore-reports,delve-reports,references}
mkdir -p grimoires/gygax/learned-lore/.promoted
mkdir -p grimoires/gygax/forks/.archived

# Append Gygax identity to project CLAUDE.md if not already present
if [[ -f "CLAUDE.md" ]]; then
  if ! grep -q "gygax/CLAUDE.md" CLAUDE.md 2>/dev/null; then
    echo "" >> CLAUDE.md
    echo "@.claude/gygax/CLAUDE.md" >> CLAUDE.md
    log "Added Gygax identity to CLAUDE.md"
  else
    log "Gygax identity already in CLAUDE.md"
  fi
else
  echo "@.claude/gygax/CLAUDE.md" > CLAUDE.md
  log "Created CLAUDE.md with Gygax identity"
fi

log ""
log "Gygax installed."
log ""
log "Commands available:"
log "  /attune    — Point at your game (doc, repo, or describe it)"
log "  /homebrew  — Design or refine a mechanic"
log "  /augury    — Run the numbers"
log "  /cabal     — Stress-test with simulated players"
log "  /lore      — TTRPG design heuristics"
log "  /scry      — Fork game-state and explore design branches"
log "  /delve     — Analyze dungeons (ecology, layout, loot)"
log "  /gygax     — Status overview"
log ""
log "Start with: /attune"
