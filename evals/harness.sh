#!/usr/bin/env bash
# Gygax Evaluation Harness — Structural Validation
# Validates fixture integrity, expected findings references, and schema compliance.
# Does NOT invoke AI skills (structural validation only).
#
# Usage:
#   bash evals/harness.sh --structural
#   bash evals/harness.sh --structural --verbose

set -euo pipefail

EVALS_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURES_DIR="$EVALS_DIR/fixtures"
EXPECTED_DIR="$EVALS_DIR/expected"

VERBOSE=false
MODE=""
PASS=0
FAIL=0
WARN=0

for arg in "$@"; do
  case $arg in
    --structural) MODE="structural" ;;
    --verbose) VERBOSE=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "Usage: bash evals/harness.sh --structural [--verbose]"
  exit 1
fi

# Colors (if terminal supports it)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' NC=''
fi

pass() { PASS=$((PASS + 1)); $VERBOSE && echo -e "  ${GREEN}PASS${NC}: $1"; true; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC}: $1"; true; }
warn() { WARN=$((WARN + 1)); $VERBOSE && echo -e "  ${YELLOW}WARN${NC}: $1"; true; }

# Valid values for validation
VALID_SKILLS="augury cabal lore delve"
VALID_LAYERS="resolution action-economy resource-economy progression pacing cognitive-load"
VALID_SIGNALS="confusion excitement dead-time decision-paralysis frustration cool-moment cognitive-overload mastery-reward"
VALID_ARCHETYPES="Optimizer Explorer Storyteller Rules Lawyer Newcomer Chaos Agent GM Anxious Player Veteran"
VALID_SEVERITIES="Critical Warning Observation"
VALID_TRADITIONS="d20 pbta fitd osr cepheus freeform custom"
VALID_ENTITY_TYPES="stats resources mechanics progression entities tensions"

echo "Gygax Evaluation Harness — Structural Validation"
echo "================================================="
echo ""

# Check fixtures directory exists
if [[ ! -d "$FIXTURES_DIR" ]]; then
  echo "ERROR: No fixtures directory at $FIXTURES_DIR"
  exit 1
fi

# Count fixtures
FIXTURE_COUNT=0
for fixture_dir in "$FIXTURES_DIR"/*/; do
  [[ -d "$fixture_dir" ]] && FIXTURE_COUNT=$((FIXTURE_COUNT + 1))
done

if [[ $FIXTURE_COUNT -eq 0 ]]; then
  echo "ERROR: No fixtures found in $FIXTURES_DIR"
  exit 1
fi

echo "Found $FIXTURE_COUNT fixture(s)"
echo ""

# Validate each fixture
for fixture_dir in "$FIXTURES_DIR"/*/; do
  [[ ! -d "$fixture_dir" ]] && continue
  fixture_name=$(basename "$fixture_dir")
  echo "Fixture: $fixture_name"

  # 1. Check manifest exists
  manifest="$fixture_dir/manifest.yaml"
  if [[ ! -f "$manifest" ]]; then
    fail "Missing manifest.yaml"
    continue
  fi
  pass "manifest.yaml exists"

  # 2. Validate manifest has required fields
  for field in id name failure_archetype tradition description source tests_skills; do
    if grep -q "^${field}:" "$manifest" 2>/dev/null; then
      pass "manifest has '$field'"
    else
      fail "manifest missing required field '$field'"
    fi
  done

  # 3. Check tradition is valid
  tradition=$(grep "^tradition:" "$manifest" 2>/dev/null | head -1 | awk '{print $2}')
  if echo "$VALID_TRADITIONS" | grep -qw "$tradition" 2>/dev/null; then
    pass "tradition '$tradition' is valid"
  else
    fail "invalid tradition: '$tradition'"
  fi

  # 4. Check game-state directory exists
  gs_dir="$fixture_dir/game-state"
  if [[ ! -d "$gs_dir" ]]; then
    fail "Missing game-state/ directory"
    continue
  fi
  pass "game-state/ directory exists"

  # 5. Check index.yaml exists
  index_file="$gs_dir/index.yaml"
  if [[ ! -f "$index_file" ]]; then
    fail "Missing game-state/index.yaml"
  else
    pass "game-state/index.yaml exists"
  fi

  # 6. Check at least one entity file exists
  entity_count=$(find "$gs_dir" -name "*.yaml" ! -name "index.yaml" | wc -l | tr -d ' ')
  if [[ $entity_count -gt 0 ]]; then
    pass "$entity_count entity file(s) found"
  else
    fail "No entity files in game-state/"
  fi

  # 7. Validate YAML syntax for all files
  yaml_errors=0
  for yaml_file in $(find "$fixture_dir" -name "*.yaml"); do
    # Basic YAML validation: check for tab characters (common error)
    if grep -P '\t' "$yaml_file" >/dev/null 2>&1; then
      fail "Tab characters in $(basename "$yaml_file") (YAML requires spaces)"
      yaml_errors=$((yaml_errors + 1))
    fi
  done
  if [[ $yaml_errors -eq 0 ]]; then
    pass "No tab characters in YAML files"
  fi

  # 8. Check entity files have required base fields
  for entity_file in $(find "$gs_dir" -name "*.yaml" ! -name "index.yaml"); do
    entity_basename=$(basename "$entity_file")
    for field in id name type description tradition; do
      if ! grep -q "^${field}:" "$entity_file" 2>/dev/null; then
        fail "$entity_basename missing base field '$field'"
      fi
    done
    # Check depends_on and affects are present (v3.1 requirement)
    if ! grep -q "^depends_on:" "$entity_file" 2>/dev/null; then
      fail "$entity_basename missing required field 'depends_on'"
    fi
    if ! grep -q "^affects:" "$entity_file" 2>/dev/null; then
      fail "$entity_basename missing required field 'affects'"
    fi
  done

  # 9. Check expected findings file exists
  expected_file="$EXPECTED_DIR/${fixture_name}.yaml"
  if [[ ! -f "$expected_file" ]]; then
    fail "Missing expected findings: expected/${fixture_name}.yaml"
    echo ""
    continue
  fi
  pass "expected/${fixture_name}.yaml exists"

  # 10. Check expected findings has required structure
  if grep -q "^fixture:" "$expected_file" 2>/dev/null; then
    pass "expected findings has 'fixture' field"
  else
    fail "expected findings missing 'fixture' field"
  fi

  if grep -q "expected_findings:" "$expected_file" 2>/dev/null; then
    pass "expected findings has 'expected_findings' section"
  else
    fail "expected findings missing 'expected_findings' section"
  fi

  # 11. Count expected findings (must be > 0)
  finding_count=$(grep -c "  - skill:" "$expected_file" 2>/dev/null || echo "0")
  if [[ $finding_count -gt 0 ]]; then
    pass "$finding_count expected finding(s) declared"
  else
    fail "Zero expected findings — every fixture needs at least one"
  fi

  # 12. Validate skill references in expected findings
  for skill_ref in $(grep "    skill:" "$expected_file" 2>/dev/null | awk '{print $2}'); do
    if echo "$VALID_SKILLS" | grep -qw "$skill_ref" 2>/dev/null; then
      pass "skill reference '$skill_ref' is valid"
    else
      fail "invalid skill reference: '$skill_ref'"
    fi
  done

  # 13. Validate layer references
  for layer_ref in $(grep "    layer:" "$expected_file" 2>/dev/null | awk '{print $2}'); do
    if echo "$VALID_LAYERS" | grep -qw "$layer_ref" 2>/dev/null; then
      pass "layer reference '$layer_ref' is valid"
    else
      fail "invalid layer reference: '$layer_ref'"
    fi
  done

  # 14. Validate severity references
  for sev_ref in $(grep "    severity:" "$expected_file" 2>/dev/null | awk '{print $2}'); do
    # Handle Critical|Warning format
    for sev in $(echo "$sev_ref" | tr '|' ' '); do
      if echo "$VALID_SEVERITIES" | grep -qw "$sev" 2>/dev/null; then
        pass "severity '$sev' is valid"
      else
        fail "invalid severity: '$sev'"
      fi
    done
  done

  echo ""
done

# Summary
echo "================================================="
echo "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}HARNESS FAILED${NC}: $FAIL structural validation error(s)"
  exit 1
else
  echo -e "${GREEN}HARNESS PASSED${NC}: All fixtures structurally valid"
  exit 0
fi
