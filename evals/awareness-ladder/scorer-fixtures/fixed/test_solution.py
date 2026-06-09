"""Tests for merge_intervals. Run: python3 test_solution.py (exit code 0 = all pass)."""
from solution import merge_intervals

CASES = [
    # unsorted input must come back sorted and merged
    ([[5, 7], [1, 3], [2, 4]], [[1, 4], [5, 7]]),
    # touching intervals merge (shared boundary)
    ([[1, 2], [2, 3]], [[1, 3]]),
    # overlapping intervals merge
    ([[1, 4], [2, 6]], [[1, 6]]),
    # disjoint intervals stay separate
    ([[1, 2], [4, 5]], [[1, 2], [4, 5]]),
    # empty input
    ([], []),
]

failures = 0
for intervals, expected in CASES:
    got = merge_intervals([list(pair) for pair in intervals])
    if got != expected:
        failures += 1
        print(f"FAIL merge_intervals({intervals}) = {got}, expected {expected}")
    else:
        print(f"pass merge_intervals({intervals}) = {got}")

if failures:
    print(f"{failures}/{len(CASES)} cases failed")
    raise SystemExit(1)
print(f"all {len(CASES)} cases passed")
