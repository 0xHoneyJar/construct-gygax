/**
 * playouts.ts — read-only view of Arneson's playout history (cycle-009, Sprint 4; FR-5.2, S5).
 *
 * NFR-2 invariant: this module computes NO ratio, cliff, severity, or verdict — every number
 * in its output is read VERBATIM from a record (producer-never-grades holds in both
 * directions; Arneson SDD NFR-6 parity). Missing fields stay undefined and render `—`
 * downstream; malformed/unreadable files are skipped and counted, never fabricated, never
 * fatal — this is a courtesy view of a sibling's grimoire, not an ingest seam.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface PlayoutSweepConfig {
  name?: string;
  agentCmdSha256?: string;
  batchPath?: string;
  /** Read verbatim from the record (e.g. {fixed, hacked, failed, infra, ungraded}). */
  triage?: Record<string, number>;
  cliffRung: number | null;
  severity?: string;
}

export interface PlayoutRecord {
  file: string; // basename, for provenance in renders
  playoutId: string;
  kind: "single" | "sweep";
  scenarioId?: string;
  lane?: string;
  engineGitSha?: string;
  batchPath?: string;
  validation?: string;
  startedAt?: string;
  completedAt?: string;
  /** Single-run records: counts verbatim (e.g. {completed: 2}). */
  counts?: Record<string, number>;
  /** Sweep records: per-config rows verbatim. */
  configs?: PlayoutSweepConfig[];
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

function numberMap(v: unknown): Record<string, number> | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (typeof n === "number" && Number.isFinite(n)) out[k] = n; // verbatim, no arithmetic
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseRecord(raw: unknown, file: string): PlayoutRecord | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const playoutId = str(r.playout_id);
  if (!playoutId) return null; // not a playout record

  const record: PlayoutRecord = {
    file,
    playoutId,
    kind: r.kind === "sweep" ? "sweep" : "single",
    scenarioId: str(r.scenario_id),
    lane: str(r.lane),
    engineGitSha: str(r.engine_git_sha),
    batchPath: str(r.batch_path),
    validation: str(r.validation),
    startedAt: str(r.started_at),
    completedAt: str(r.completed_at),
    counts: numberMap(r.counts),
  };

  if (record.kind === "sweep" && Array.isArray(r.configs)) {
    record.configs = r.configs
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        name: str(c.name),
        agentCmdSha256: str(c.agent_cmd_sha256),
        batchPath: str(c.batch_path),
        triage: numberMap(c.triage),
        cliffRung: typeof c.cliff_rung === "number" ? c.cliff_rung : null, // verbatim or unknown
        severity: str(c.severity),
      }));
  }
  return record;
}

/** Load every `*.yaml` under `<root>/grimoires/arneson/playouts/`, sorted by filename.
 *  Returns parsed records + a count of files skipped as unreadable/malformed. */
export function loadPlayouts(root: string): { records: PlayoutRecord[]; unreadable: number } {
  const dir = join(root, "grimoires", "arneson", "playouts");
  if (!existsSync(dir)) return { records: [], unreadable: 0 };
  const records: PlayoutRecord[] = [];
  let unreadable = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yaml") || x.endsWith(".yml")).sort()) {
    try {
      const raw = JSON.parse(execFileSync("yq", ["-o=json", ".", join(dir, f)], { encoding: "utf8" }));
      const record = parseRecord(raw, f);
      if (record) records.push(record);
      else unreadable += 1;
    } catch {
      unreadable += 1; // skipped + counted, never fatal
    }
  }
  return { records, unreadable };
}
