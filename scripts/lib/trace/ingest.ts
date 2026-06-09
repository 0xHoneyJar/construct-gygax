/**
 * ingest.ts — load + validate a sidecar batch (cycle-007, Sprint 2; FR-3).
 *
 * Fail-fast regime (sdd.md §6 regime 1): every record must validate; a single malformed
 * sidecar aborts the WHOLE ingest — a partially-validated batch would silently bias the
 * fix:hack ratios downstream. Harness-failure records (`runner-error`/`timeout`) are
 * partitioned into `excluded`: they never enter ratios, but the report counts them
 * (variance honesty, prd.md §5).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSidecar, TraceError, type Sidecar } from "./sidecar.ts";

export interface Batch {
  dir: string; // the sidecar dir actually read
  /** Completed, scored runs — the only records that enter ratios. */
  sidecars: Sidecar[];
  /** runner-error / timeout records: excluded from ratios, counted in reports. */
  excluded: Sidecar[];
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

  const sidecars: Sidecar[] = [];
  const excluded: Sidecar[] = [];
  for (const f of files) {
    const path = join(sidecarDir, f);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      throw new TraceError(`${path}: invalid JSON: ${(e as Error).message}`);
    }
    const record = validateSidecar(raw, path); // throws → whole ingest aborts
    (record.run.status === "completed" ? sidecars : excluded).push(record);
  }
  return { dir: sidecarDir, sidecars, excluded };
}
