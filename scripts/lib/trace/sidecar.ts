/**
 * sidecar.ts — the observed-trace/v1 contract, typed + validated (cycle-007, Sprint 1).
 *
 * TypeScript mirror of `schemas/observed-trace.v1.schema.json` (the authoritative cross-repo
 * artifact) with a hand-rolled validator — no ajv, zero-dep posture (sdd.md §2). Validation is
 * fail-fast and typed: every rejection is a TraceError carrying the source file path, because a
 * partially-validated batch would silently bias downstream ratios (sdd.md §6).
 *
 * Ground truth = `observation` (scorer-produced diffs + re-run exit code). `narration` is a
 * secondary field, never an input to classification. `claim_strength` is per-record and
 * producer-bound: a simulation may not launder its output as observed data.
 */

/** Epistemic strength ordering: real-agent-observed > simulation-derived > model-forecast.
 *  `model-forecast` exists for report-layer forecast lines only — it is never a valid sidecar
 *  claim (a sidecar is an observation by definition; see schema enum). */
export type ClaimStrength = "real-agent-observed" | "simulation-derived" | "model-forecast";
export type SidecarClaim = Exclude<ClaimStrength, "model-forecast">;
export type Classification = "fixed" | "hacked" | "failed";
export type RunStatus = "completed" | "runner-error" | "timeout" | "infra-failure";
export type ArtifactStatus = "intact" | "modified" | "added" | "deleted";
export type ProducerKind = "real-agent" | "simulation";

export interface ArtifactDiff {
  path: string; // relative to the run dir
  status: ArtifactStatus;
  diff: string; // unified diff vs template ("" for intact)
}

/** v1.1: opaque producer-side provenance — displayed, never interpreted (FR-4.1). */
export interface ProducerProvenance {
  agent_cmd_sha256?: string;
  engine_git_sha?: string;
  model_id?: string;
  construct_sha?: string;
}

export interface Producer {
  kind: ProducerKind;
  id: string;
  detail?: string;
  provenance?: ProducerProvenance;
}

export interface ExperimentMeta {
  id: string;
  fixture: string;
  incentive_state: string;
  context: { name: string; value: number };
}

export interface RunMeta {
  rung: number; // 0..2
  rung_name: "blind" | "reward-aware" | "adversarial";
  trial: number; // 1..N
  status: RunStatus;
  run_dir: string;
  started_at: string; // ISO 8601
  duration_ms: number;
}

export interface Observation {
  classification: Classification;
  exit_code: number; // the scorer's OWN re-run, never the runner's captured code
  anomaly_note: string | null;
  artifacts: ArtifactDiff[];
}

export interface Sidecar {
  schema: "observed-trace/v1";
  claim_strength: SidecarClaim;
  producer: Producer;
  experiment: ExperimentMeta;
  run: RunMeta;
  /** Present iff run.status === "completed" (a harness failure has nothing observed). */
  observation?: Observation;
  narration: string;
}

export class TraceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceError";
  }
}

export const SCHEMA_VERSION = "observed-trace/v1";

const CLAIM_BY_PRODUCER: Record<ProducerKind, SidecarClaim> = {
  "real-agent": "real-agent-observed",
  simulation: "simulation-derived",
};

const RUNG_NAMES = ["blind", "reward-aware", "adversarial"] as const;
const STATUSES: RunStatus[] = ["completed", "runner-error", "timeout", "infra-failure"];
const PROVENANCE_KEYS = ["agent_cmd_sha256", "engine_git_sha", "model_id", "construct_sha"] as const;
const CLASSIFICATIONS: Classification[] = ["fixed", "hacked", "failed"];
const ARTIFACT_STATUSES: ArtifactStatus[] = ["intact", "modified", "added", "deleted"];

function fail(file: string, msg: string): never {
  throw new TraceError(`${file}: ${msg}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(file: string, obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) fail(file, `${where}.${key} must be a non-empty string`);
  return v;
}

function reqInt(file: string, obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) fail(file, `${where}.${key} must be an integer`);
  return v;
}

/** Validate a parsed JSON value as an observed-trace/v1 sidecar. Throws TraceError (with the
 *  source file path in the message) on any contract violation; returns the typed record. */
export function validateSidecar(raw: unknown, file: string): Sidecar {
  if (!isRecord(raw)) fail(file, "sidecar must be a JSON object");

  if (raw.schema !== SCHEMA_VERSION) {
    fail(file, `unknown schema version ${JSON.stringify(raw.schema)} (expected "${SCHEMA_VERSION}")`);
  }

  // producer + producer-bound claim strength
  if (!isRecord(raw.producer)) fail(file, "producer must be an object");
  const kind = raw.producer.kind;
  if (kind !== "real-agent" && kind !== "simulation") {
    fail(file, `producer.kind must be "real-agent" or "simulation" (got ${JSON.stringify(kind)})`);
  }
  const producerId = reqString(file, raw.producer, "id", "producer");
  const detail = raw.producer.detail;
  if (detail !== undefined && typeof detail !== "string") fail(file, "producer.detail must be a string when present");

  // producer.provenance (v1.1, optional): opaque strings, unknown keys rejected (schema parity)
  let provenance: ProducerProvenance | undefined;
  if (raw.producer.provenance !== undefined) {
    const prov = raw.producer.provenance;
    if (!isRecord(prov)) fail(file, "producer.provenance must be an object when present");
    for (const k of Object.keys(prov)) {
      if (!(PROVENANCE_KEYS as readonly string[]).includes(k)) {
        fail(file, `producer.provenance.${k} is not a known provenance field (${PROVENANCE_KEYS.join(" | ")})`);
      }
      const v = prov[k];
      if (typeof v !== "string" || v.length === 0) fail(file, `producer.provenance.${k} must be a non-empty string when present`);
    }
    provenance = prov as ProducerProvenance;
  }

  const expectedClaim = CLAIM_BY_PRODUCER[kind];
  if (raw.claim_strength !== expectedClaim) {
    fail(
      file,
      `claim_strength ${JSON.stringify(raw.claim_strength)} is inconsistent with producer.kind "${kind}" ` +
        `(must be "${expectedClaim}" — observations are producer-bound; simulation output may not be tagged as observed)`,
    );
  }

  // experiment
  if (!isRecord(raw.experiment)) fail(file, "experiment must be an object");
  const experiment: ExperimentMeta = {
    id: reqString(file, raw.experiment, "id", "experiment"),
    fixture: reqString(file, raw.experiment, "fixture", "experiment"),
    incentive_state: reqString(file, raw.experiment, "incentive_state", "experiment"),
    context: (() => {
      const ctx = raw.experiment.context;
      if (!isRecord(ctx)) fail(file, "experiment.context must be an object");
      const name = reqString(file, ctx, "name", "experiment.context");
      const value = ctx.value;
      if (typeof value !== "number" || !Number.isFinite(value)) fail(file, "experiment.context.value must be a finite number");
      return { name, value };
    })(),
  };

  // run
  if (!isRecord(raw.run)) fail(file, "run must be an object");
  const rung = reqInt(file, raw.run, "rung", "run");
  if (rung < 0 || rung > 2) fail(file, `run.rung ${rung} out of range (0..2 in observed-trace/v1)`);
  const rungName = raw.run.rung_name;
  if (!RUNG_NAMES.includes(rungName as (typeof RUNG_NAMES)[number])) {
    fail(file, `run.rung_name must be one of ${RUNG_NAMES.join(" | ")} (got ${JSON.stringify(rungName)})`);
  }
  const trial = reqInt(file, raw.run, "trial", "run");
  if (trial < 1) fail(file, `run.trial ${trial} out of range (>= 1)`);
  const status = raw.run.status;
  if (!STATUSES.includes(status as RunStatus)) {
    fail(file, `run.status must be one of ${STATUSES.join(" | ")} (got ${JSON.stringify(status)})`);
  }
  const run: RunMeta = {
    rung,
    rung_name: rungName as RunMeta["rung_name"],
    trial,
    status: status as RunStatus,
    run_dir: reqString(file, raw.run, "run_dir", "run"),
    started_at: reqString(file, raw.run, "started_at", "run"),
    duration_ms: (() => {
      const v = raw.run.duration_ms;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) fail(file, "run.duration_ms must be a number >= 0");
      return v;
    })(),
  };

  // observation — the GRADING MARKER (cycle-008): optional on a completed run (present = graded;
  // absent = ran-but-ungraded, to be filled on ingest). A non-completed run must NOT carry one.
  let observation: Observation | undefined;
  if (run.status === "completed" && raw.observation !== undefined) {
    if (!isRecord(raw.observation)) {
      fail(file, "observation, when present, must be an object");
    }
    const obs = raw.observation;
    const classification = obs.classification;
    if (!CLASSIFICATIONS.includes(classification as Classification)) {
      fail(file, `observation.classification must be one of ${CLASSIFICATIONS.join(" | ")} (got ${JSON.stringify(classification)})`);
    }
    const exitCode = reqInt(file, obs, "exit_code", "observation");
    const anomaly = obs.anomaly_note;
    if (anomaly !== null && typeof anomaly !== "string") {
      fail(file, "observation.anomaly_note must be a string or null");
    }
    if (!Array.isArray(obs.artifacts)) fail(file, "observation.artifacts must be an array");
    const artifacts: ArtifactDiff[] = obs.artifacts.map((a, i) => {
      if (!isRecord(a)) fail(file, `observation.artifacts[${i}] must be an object`);
      const path = reqString(file, a, "path", `observation.artifacts[${i}]`);
      const aStatus = a.status;
      if (!ARTIFACT_STATUSES.includes(aStatus as ArtifactStatus)) {
        fail(file, `observation.artifacts[${i}].status must be one of ${ARTIFACT_STATUSES.join(" | ")} (got ${JSON.stringify(aStatus)})`);
      }
      const diff = a.diff;
      if (typeof diff !== "string") fail(file, `observation.artifacts[${i}].diff must be a string`);
      return { path, status: aStatus as ArtifactStatus, diff };
    });
    observation = { classification: classification as Classification, exit_code: exitCode, anomaly_note: anomaly as string | null, artifacts };
  } else if (run.status !== "completed" && raw.observation !== undefined) {
    fail(file, `a "${run.status}" run must not carry an observation block (nothing ran to grade; excluded-not-hidden)`);
  }

  const narration = raw.narration;
  if (typeof narration !== "string") fail(file, "narration must be a string (may be empty)");

  const sidecar: Sidecar = {
    schema: SCHEMA_VERSION,
    claim_strength: expectedClaim,
    producer: { kind, id: producerId, ...(detail !== undefined ? { detail } : {}), ...(provenance !== undefined ? { provenance } : {}) },
    experiment,
    run,
    ...(observation !== undefined ? { observation } : {}),
    narration,
  };
  return sidecar;
}


/** A sidecar is GRADED iff it carries an observation (cycle-008 grading marker). A completed
 *  run without an observation ran but has not yet been scored by Gygax. */
export function isGraded(s: Sidecar): boolean {
  return s.observation !== undefined;
}
