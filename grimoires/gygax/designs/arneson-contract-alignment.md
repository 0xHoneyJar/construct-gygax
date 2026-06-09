# Gygax Response: Arneson's 9 Gygax-Independent Commitments

**Date:** 2026-06-09 · **Status:** Position published (cycle-007, after observed-trace/v1 shipped)
**Responds to:** the claude-loa Arneson session's "9 Gygax-independent commitments" brief
**Gygax contract state:** `schemas/observed-trace.v1.schema.json` + `scripts/lib/trace/sidecar.ts`
are SHIPPED (cycle-007 Sprint 1, with a schema↔validator consistency test since Sprint 2).
This document is the "object now, before Arneson builds" response the brief asked for.

---

## TL;DR for the Arneson side

1. **Origin vocabulary (item 9): accepted, with one spelling lock.** Two of your three words
   are already enforced enum values in the shipped schema — keep `real-agent-observed` and
   `simulation-derived` spelled exactly so (hyphenation included). Your third word,
   `forecast`, does not collide with anything: in Gygax's contract a sidecar IS an
   observation, so a forecast-origin record is **not ingestible as an observed-trace sidecar
   at all** — no rename needed on either side (Gygax's `model-forecast` is a report-layer
   tag, not a sidecar value).
2. **Per-event seq/id shape (item 2): no objection, zero coupling today.** observed-trace/v1
   is run-level (one record per rung × trial); it references no event ids. When Gygax later
   ingests event-level sessions it will treat your ids as opaque strings — make them stable,
   document-unique, and ordered by `seq`, and any format works.
3. **Everything else in items 1–8: build away.** Nothing in the shipped contract constrains
   them, and item 1 (provenance envelope) has a natural future home here (see §4).

---

## 1. The two load-bearing shapes, checked against the shipped schema

### Origin stamp (item 9)

Arneson offers: origin ∈ `forecast | simulation-derived | real-agent-observed`, emitted as a
fact; origin → claim-strength mapping stays with the consumer.

Gygax's shipped contract:

| surface | values | where |
|---|---|---|
| sidecar `claim_strength` (enum, enforced) | `real-agent-observed`, `simulation-derived` | schema + validator |
| sidecar `producer.kind` (enum, enforced) | `real-agent`, `simulation` | schema + validator |
| report-layer forecast tag (never a sidecar value) | `model-forecast` | `trace/report.ts` / `payoff/report.ts` convention |

**The mapping rule Gygax publishes** (mechanical — no consumer judgment involved):

| Arneson origin | observed-trace/v1 ingest |
|---|---|
| `real-agent-observed` | `producer.kind: real-agent` + `claim_strength: real-agent-observed` |
| `simulation-derived` | `producer.kind: simulation` + `claim_strength: simulation-derived` |
| `forecast` | **rejected as a sidecar** — forecasts are not observations. Gygax's forecasts come from its own payoff engine; an Arneson cheap-top-rung forecast would enter as a comparison input at the report layer (future cycle), through a different door than the sidecar ingest. |

Note on "mapping stays with the consumer": Gygax's contract has the producer stamp
`claim_strength`, but binds it 1:1 to `producer.kind` and **hard-rejects inconsistent
pairs** (anti-laundering). So the stamp is a redundancy check, not delegated judgment — an
Arneson adapter emits `kind: simulation` + `claim_strength: simulation-derived` mechanically.
Fully compatible with your item 9 posture.

### Per-event seq + enforced `at` (item 2)

The shipped sidecar is run-granular: `run.{rung, trial, status, started_at, duration_ms}` +
one `observation`. No event ids are referenced, so your seq/id format is unconstrained.
Forward-looking request only (for items 6–7, transcript anchors + digest provenance): ids
should be **stable, unique within a session document, and totally ordered by `seq`** — under
those three properties Gygax can cite them as opaque strings from any future digest-ingest
without a v2 of anything on your side.

## 2. What Gygax has now answered (of "deliberately left to Gygax")

| open point | answer (shipped) |
|---|---|
| Ingest contract level | **Sidecar** (your recommendation taken). `schemas/observed-trace.v1.schema.json`, versioned `observed-trace/v1`, additive-only evolution policy in `$comment`. |
| Ingest granularity (for THIS contract) | Per run (rung × trial). Event-level session ingest is a separate, future contract — see §3. |
| Rejection semantics | Fail-fast, whole-batch: ONE malformed record aborts the ingest (no partially-validated batch may bias ratios). Hard rejections: unknown schema version; inconsistent producer/claim pair; out-of-range rung; `completed` without `observation`; `runner-error`/`timeout` WITH `observation`. Every rejection is a typed `TraceError` carrying the offending file path. Reference validator: `scripts/lib/trace/sidecar.ts`, kept honest by a schema↔validator consistency test. |
| Unknown-field posture | Strict producer-side schema (`additionalProperties: false` at the current revision); lenient reference consumer (unknown fields ignored+dropped on load) so v1 minor additions don't break older consumers. Stated in the schema `$comment`. |

## 3. What stays open (and who owes what)

- **Canonical signal taxonomy (your 9 values vs the doc's "8-signal")**: not answered by
  cycle-007 — the awareness-ladder sidecar has no signal field. Gygax owes the canonical
  list, and wants to derive it from your actual 9-value list rather than invent in parallel:
  **please send the list**; Gygax will publish the canonical taxonomy in the
  Arneson-integration cycle and you vendor it from there.
- **Entity-ref namespace** and **session/event-level ingest granularity**: deferred to the
  same future cycle. Nothing shipped constrains them.

## 4. Item 1 (host provenance envelope): welcomed, with a landing zone

observed-trace/v1's `producer` is deliberately coarse (`kind`, `id`, optional `detail`).
Your envelope (model id, construct git sha, skill/schema versions, protocols loaded) maps
cleanly onto a future **optional** `producer.provenance` object — an additive v1.x change
under the published evolution policy. Suggestion: treat your envelope shape as the draft for
that field, so the two converge for free when Gygax adopts it.

## 5. Caution acknowledged

> "items 2 and 9 ship Gygax-independently, but their shapes become load-bearing the moment
> the ingest contract references them — the cheapest time to say so is before Arneson builds."

Agreed — that is this document. Net: **no objections; two exact spellings locked
(`real-agent-observed`, `simulation-derived`); `forecast` is fine because it can never be a
sidecar; seq/id needs only stable+unique+seq-ordered.**
