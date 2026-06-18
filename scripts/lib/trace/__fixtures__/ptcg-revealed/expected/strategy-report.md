## Revealed Strategy

Claim strength: **observed** — revealed preference over 8 decisions (1 segment). **Revealed ≠ optimal:** this is the empirical equilibrium of the corpus, not a proof of best play.

### Revealed ordering (overall)
| Rank | Action type | Conditional pick-rate | Offered | Chosen |
|-----:|-------------|----------------------:|--------:|-------:|
| 1 | ATTACH | 100% | 3 | 3 |
| 2 | EVOLVE | 50% | 4 | 2 |
| 3 | PLAY | 40% | 5 | 2 |
| 4 | ABILITY | 14% | 7 | 1 |
| 5 | ATTACK | 0% | 7 | 0 |

### Findings
- **[observed]** Revealed dominant line: ATTACH > EVOLVE > PLAY > ABILITY > ATTACK.
  - top action ATTACH chosen 100% of the times it was offered (n=8).
- **[observed]** Forecast MISSED a false choice at "the main-phase action choice": forecast "balanced", but play is a near-pure ATTACH line.
  - observed top ATTACH 100%; forecast balanced [model-forecast]; n=8.
- **[observed]** Policy divergence: v1.1 ranks ATTACH #6, but play reveals it #1 (Δ5).
  - ATTACH: candidate #6 → observed #1 [v1.1=model-forecast]; n=8.
- **[observed]** Policy divergence: v1.1 ranks ABILITY #1, but play reveals it #4 (Δ3).
  - ABILITY: candidate #1 → observed #4 [v1.1=model-forecast]; n=8.
- **[observed]** Policy divergence: v1.1 ranks EVOLVE #3, but play reveals it #2 (Δ1).
  - EVOLVE: candidate #3 → observed #2 [v1.1=model-forecast]; n=8.
- **[observed]** Policy divergence: v1.1 ranks PLAY #2, but play reveals it #3 (Δ1).
  - PLAY: candidate #2 → observed #3 [v1.1=model-forecast]; n=8.

> Claim discipline: observed > simulation-derived > model-forecast. The observed ordering is from real play; forecast and candidate-policy lines are model-forecast and are never blended into it.
