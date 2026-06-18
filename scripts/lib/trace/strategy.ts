/**
 * strategy.ts — the revealed-strategy lens: orchestration + CLI (cycle-012, Sprint 37; FR-3).
 *
 * corpus → revealed preference → reconcile (forecast Decision Point Map + candidate policy) →
 * Revealed Strategy report. The thin shell behind `/cabal --observed --strategy`. Progress → stderr,
 * report → stdout (construct-runtime convention; sdd.md §3.3). Exits non-zero on a TraceError.
 *
 *   npx tsx scripts/lib/trace/strategy.ts <corpus-dir> [--forecast <dpm.json>] [--policy <policy.json>] [--n-floor <n>]
 */
import { readFileSync } from "node:fs";
import { loadCorpus } from "./decision.ts";
import { extractRevealed, type RevealedPreference } from "./revealed.ts";
import { reconcile, type ForecastDecisionMap, type CandidatePolicy, type Reconciliation } from "./reconcile.ts";
import { renderStrategyReport } from "./strategy-report.ts";
import { TraceError } from "./sidecar.ts";

export interface StrategyAnalysis {
  revealed: RevealedPreference;
  reconciliation: Reconciliation;
  report: string;
}

/** Run the lens over a corpus dir with an optional forecast map and candidate policy. */
export function analyzeStrategy(
  corpusDir: string,
  forecast?: ForecastDecisionMap,
  policy?: CandidatePolicy,
  nFloor?: number,
): StrategyAnalysis {
  const corpus = loadCorpus(corpusDir);
  const revealed = extractRevealed(corpus);
  const reconciliation = reconcile(revealed, forecast, policy, nFloor !== undefined ? { nFloor } : {});
  const report = renderStrategyReport(revealed, reconciliation);
  return { revealed, reconciliation, report };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new TraceError(`${path}: ${(e as Error).message}`);
  }
}

/** Structural guards for the two optional forecast inputs (they are forecasts, not the validated corpus). */
function asForecast(v: unknown, path: string): ForecastDecisionMap {
  if (typeof v !== "object" || v === null || !Array.isArray((v as { points?: unknown }).points)) {
    throw new TraceError(`${path}: forecast must be { points: [...], claim: "model-forecast" }`);
  }
  return { points: (v as ForecastDecisionMap).points, claim: "model-forecast" };
}
function asPolicy(v: unknown, path: string): CandidatePolicy {
  const p = v as { id?: unknown; ordering?: unknown };
  if (typeof v !== "object" || v === null || typeof p.id !== "string" || !Array.isArray(p.ordering)) {
    throw new TraceError(`${path}: policy must be { id: string, ordering: string[] }`);
  }
  return { id: p.id, ordering: p.ordering as string[] };
}

// CLI: `npx tsx scripts/lib/trace/strategy.ts <corpus-dir> [--forecast <f>] [--policy <p>] [--n-floor <n>]`
if (process.argv[1]?.endsWith("strategy.ts") && process.argv[1]?.includes("trace")) {
  const args = process.argv.slice(2);
  let dir: string | undefined;
  let forecastPath: string | undefined;
  let policyPath: string | undefined;
  let nFloor: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--forecast") forecastPath = args[++i];
    else if (args[i] === "--policy") policyPath = args[++i];
    else if (args[i] === "--n-floor") nFloor = Number(args[++i]);
    else if (!dir) dir = args[i];
    else {
      process.stderr.write(`unexpected argument: ${args[i]}\n`);
      process.exit(2);
    }
  }
  if (!dir || (nFloor !== undefined && !Number.isFinite(nFloor))) {
    process.stderr.write("usage: strategy.ts <corpus-dir> [--forecast <dpm.json>] [--policy <policy.json>] [--n-floor <n>]\n");
    process.exit(2);
  }
  try {
    const forecast = forecastPath ? asForecast(readJson(forecastPath), forecastPath) : undefined;
    const policy = policyPath ? asPolicy(readJson(policyPath), policyPath) : undefined;
    process.stderr.write(
      `[strategy] corpus=${dir}${forecastPath ? ` forecast=${forecastPath}` : ""}${policyPath ? ` policy=${policyPath}` : ""} ...\n`,
    );
    const { revealed, reconciliation, report } = analyzeStrategy(dir, forecast, policy, nFloor);
    process.stderr.write(
      `revealed ${revealed.overall.n} decisions; ordering ${revealed.overall.ordering.join(" > ")}; ` +
        `${reconciliation.findings.length} findings\n`,
    );
    process.stdout.write(report);
  } catch (e) {
    if (e instanceof TraceError) {
      process.stderr.write(`[strategy] ${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }
}
