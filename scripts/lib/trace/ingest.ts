/**
 * ingest.ts — load + validate a sidecar batch (cycle-007, Sprint 2; FR-3).
 *
 * Fail-fast regime (sdd.md §6 regime 1): every record must validate; a single malformed
 * sidecar aborts the WHOLE ingest — a partially-validated batch would silently bias the
 * fix:hack ratios downstream. Harness-failure records (`runner-error`/`timeout`) are
 * partitioned into `excluded`: they never enter ratios, but the report counts them
 * (variance honesty, prd.md §5).
 *
 * Infra triage (cycle-009, v1.1): an infrastructure failure — the producer's wrapper, not the
 * agent — is a NON-RUN, never a verdict. Canonical triage order pinned in
 * observed-trace-batch.v1.md, mirroring Arneson's sweep_report.py exactly:
 * run.status → narration INFRA_MARKER → observation → ungraded. The marker WINS over a
 * producer-supplied observation: an infra-bucketed run is never graded.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSidecar, TraceError, type Sidecar } from "./sidecar.ts";

/** Producer-side infra marker (v1.1 narration fallback for pre-v1.1 producers). Byte-equal to
 *  Arneson's validate_batch.py / sweep_report.py regex — the `-agent`/`-wrapper` suffix anchor
 *  keeps generic `ERROR: [x]` prose from matching. */
export const INFRA_MARKER = /ERROR: \[[A-Za-z0-9_-]*(?:agent|wrapper)\]/;

export interface Batch {
  dir: string; // the sidecar dir actually read
  /** Completed, scored runs — the only records that enter ratios. */
  sidecars: Sidecar[];
  /** runner-error / timeout records: excluded from ratios, counted in reports. */
  excluded: Sidecar[];
  /** Infrastructure failures (v1.1 status or narration marker): non-runs, never graded,
   *  excluded from ratios, surfaced in their own report column. */
  infra: Sidecar[];
}

/** Canonical triage (observed-trace-batch.v1.md): status → marker → verdict/ungraded. */
function triage(record: Sidecar): "sidecars" | "excluded" | "infra" {
  if (record.run.status === "runner-error" || record.run.status === "timeout") return "excluded";
  if (record.run.status === "infra-failure") return "infra";
  // completed: the narration marker wins over any producer-supplied observation
  if (INFRA_MARKER.test(record.narration)) return "infra";
  return "sidecars";
}

/** Load every `*.json` under `<dir>/sidecars/` (or `<dir>` itself if no sidecars/ child).
 *  Validates ALL records before returning; throws TraceError on the first violation. */
export function loadBatch(dir: string): Batch {
  if (!existsSync(dir)) throw new TraceError(`batch dir not found: ${dir}`);
  const sidecarDir = existsSync(join(dir, "sidecars")) ? join(dir, "sidecars") : dir;
  const files = readdirSync(sidecarDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new TraceError(`no sidecar records (*.json) in ${sidecarDir}`);

  const batch: Batch = { dir: sidecarDir, sidecars: [], excluded: [], infra: [] };
  for (const f of files) {
    const path = join(sidecarDir, f);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      throw new TraceError(`${path}: invalid JSON: ${(e as Error).message}`);
    }
    const record = validateSidecar(raw, path); // throws → whole ingest aborts
    batch[triage(record)].push(record);
  }
  return batch;
}
