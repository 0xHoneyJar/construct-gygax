/**
 * validate.ts — Cabal custom-archetype schema validation + merge (cycle-011, FR-2).
 *
 * Designers may author their own player archetypes in `grimoires/gygax/archetypes/*.yaml`. This
 * module validates each against the authored schema (`./schema.yaml`, derived from the 9 built-ins)
 * and merges valid user archetypes with the built-ins — built-ins stay; user archetypes extend
 * (PRD FR-2). Collisions with a built-in (or an earlier user file) id are REJECTED loud, never
 * silently shadowed (SDD §10 Q2). Invalid files are EXCLUDED with a field-level error, never
 * silently dropped (FR-2.5).
 *
 * The schema is interpreted generically — enum sets live in schema.yaml, the single source of
 * truth. YAML is read via `yq` (the repo's existing convention — no in-process YAML dependency;
 * mirrors scripts/lib/parametric/index.ts). Zero new runtime dependencies (NFR-2).
 *
 * Also a CLI: `tsx scripts/lib/archetypes/validate.ts [<file>]` — exits 0 (valid) / 1 (invalid),
 * and the reusable backbone of the FR-3 `/gygax check` archetype sub-check.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

export const SCHEMA_PATH = join(HERE, "schema.yaml");
export const DEFAULT_BUILTINS = join(ROOT, "skills", "cabal", "resources", "archetypes.yaml");
export const DEFAULT_USER_DIR = join(ROOT, "grimoires", "gygax", "archetypes");

// ─── YAML I/O (yq convention — see index.ts) ──────────────────────────────────────────────────

/** Read a YAML/JSON file into a plain JS value via `yq` (no in-process YAML dep). Throws on parse failure. */
export function loadYaml(file: string): unknown {
  if (extname(file) === ".json") return JSON.parse(readFileSync(file, "utf8"));
  try {
    const json = execFileSync("yq", ["-o=json", ".", file], { encoding: "utf8" });
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`failed to parse ${file} via yq (is yq installed?): ${(e as Error).message}`);
  }
}

// ─── Mini-schema interpreter ──────────────────────────────────────────────────────────────────

export interface SchemaNode {
  type: "object" | "list" | "map" | "enum" | "string";
  required?: string[];
  fields?: Record<string, SchemaNode>;
  item?: SchemaNode;
  min_items?: number;
  value?: SchemaNode;
  required_keys?: string[];
  values?: string[]; // enum
  pattern?: string; // string
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function typeName(v: unknown): string {
  if (Array.isArray(v)) return "list";
  if (v === null) return "null";
  return typeof v;
}

function joinPath(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

/** Walk a schema node against a value, accumulating `<path> — <expected vs found>` errors. */
function validateNode(node: SchemaNode, value: unknown, path: string, errors: string[]): void {
  const where = path || "(root)";
  switch (node.type) {
    case "string": {
      if (typeof value !== "string") {
        errors.push(`${where} — expected string, found ${typeName(value)}`);
        return;
      }
      if (node.pattern && !new RegExp(node.pattern).test(value)) {
        errors.push(`${where} — expected string matching ${node.pattern}, found ${JSON.stringify(value)}`);
      }
      return;
    }
    case "enum": {
      const allowed = node.values ?? [];
      if (typeof value !== "string" || !allowed.includes(value)) {
        errors.push(`${where} — expected one of [${allowed.join(", ")}], found ${JSON.stringify(value)}`);
      }
      return;
    }
    case "list": {
      if (!Array.isArray(value)) {
        errors.push(`${where} — expected list, found ${typeName(value)}`);
        return;
      }
      if (node.min_items != null && value.length < node.min_items) {
        errors.push(`${where} — expected at least ${node.min_items} item(s), found ${value.length}`);
      }
      if (node.item) {
        value.forEach((el, i) => validateNode(node.item!, el, joinPath(path, i), errors));
      }
      return;
    }
    case "object": {
      if (!isPlainObject(value)) {
        errors.push(`${where} — expected object, found ${typeName(value)}`);
        return;
      }
      for (const req of node.required ?? []) {
        if (value[req] == null) errors.push(`${joinPath(path, req)} — required, but missing`);
      }
      for (const [k, fieldNode] of Object.entries(node.fields ?? {})) {
        if (value[k] != null) validateNode(fieldNode, value[k], joinPath(path, k), errors);
      }
      return;
    }
    case "map": {
      if (!isPlainObject(value)) {
        errors.push(`${where} — expected object, found ${typeName(value)}`);
        return;
      }
      for (const rk of node.required_keys ?? []) {
        if (value[rk] == null) errors.push(`${joinPath(path, rk)} — required key, but missing`);
      }
      if (node.value) {
        for (const [k, v] of Object.entries(value)) {
          validateNode(node.value, v, joinPath(path, k), errors);
        }
      }
      return;
    }
    default:
      errors.push(`${where} — unknown schema node type ${JSON.stringify((node as SchemaNode).type)}`);
  }
}

let cachedSchema: SchemaNode | null = null;

/** Load the archetype schema's root node from schema.yaml (cached). */
export function loadSchema(schemaPath: string = SCHEMA_PATH): SchemaNode {
  if (schemaPath === SCHEMA_PATH && cachedSchema) return cachedSchema;
  const doc = loadYaml(schemaPath) as { root?: SchemaNode };
  if (!doc || !doc.root) throw new Error(`schema ${schemaPath} has no \`root\` node`);
  if (schemaPath === SCHEMA_PATH) cachedSchema = doc.root;
  return doc.root;
}

/** Validate a single archetype document against the schema. */
export function validateArchetype(doc: unknown, schema: SchemaNode = loadSchema()): ValidationResult {
  const errors: string[] = [];
  validateNode(schema, doc, "", errors);
  return { valid: errors.length === 0, errors };
}

/** A file may hold one archetype (top-level object) or a `{ archetypes: [...] }` roster. Normalize to a list. */
export function extractArchetypes(doc: unknown): unknown[] {
  if (isPlainObject(doc) && Array.isArray(doc.archetypes)) return doc.archetypes;
  return [doc];
}

export interface MergeResult {
  /** Built-ins first, then accepted user archetypes, in deterministic order. */
  archetypes: Array<Record<string, unknown>>;
  /** File-prefixed, field-level errors for every excluded/colliding archetype. */
  errors: string[];
}

function listYamlFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => [".yaml", ".yml"].includes(extname(f)))
    .sort() // deterministic order (NFR-1)
    .map((f) => join(dir, f));
}

/**
 * Load built-ins + every user archetype, validate each, reject id collisions, return the merged
 * roster plus an error list. Built-ins are canonical (always retained) but still validated so drift
 * surfaces. User archetypes that fail validation or collide are EXCLUDED and reported.
 */
export function loadAndMerge(
  builtinsPath: string = DEFAULT_BUILTINS,
  userDir: string = DEFAULT_USER_DIR,
  schema: SchemaNode = loadSchema(),
): MergeResult {
  const archetypes: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  const seenIds = new Map<string, string>(); // id -> source (file path or "built-in")

  // Built-ins — canonical ground truth, retained even if drift is detected.
  const builtins = extractArchetypes(loadYaml(builtinsPath));
  for (const arch of builtins) {
    const res = validateArchetype(arch, schema);
    for (const e of res.errors) errors.push(`${builtinsPath}: ${e}`);
    if (isPlainObject(arch) && typeof arch.id === "string") seenIds.set(arch.id, "built-in");
    archetypes.push(arch as Record<string, unknown>);
  }

  // User archetypes — validate, reject-on-collision, exclude on failure.
  for (const file of listYamlFiles(userDir)) {
    let docs: unknown[];
    try {
      docs = extractArchetypes(loadYaml(file));
    } catch (e) {
      errors.push(`${file}: ${(e as Error).message}`);
      continue;
    }
    for (const arch of docs) {
      const res = validateArchetype(arch, schema);
      if (!res.valid) {
        for (const e of res.errors) errors.push(`${file}: ${e}`);
        continue; // excluded, but reported
      }
      const id = (arch as Record<string, unknown>).id as string;
      const clash = seenIds.get(id);
      if (clash) {
        errors.push(`${file}: id ${JSON.stringify(id)} — collides with an existing archetype (${clash}); rejected`);
        continue;
      }
      seenIds.set(id, file);
      archetypes.push(arch as Record<string, unknown>);
    }
  }

  return { archetypes, errors };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────────────────────

function runCli(argv: string[]): number {
  const schema = loadSchema();
  const fileArg = argv[2];

  if (fileArg) {
    // Validate one file (single archetype or roster). Exit 0 if all archetypes in it are valid.
    let docs: unknown[];
    try {
      docs = extractArchetypes(loadYaml(fileArg));
    } catch (e) {
      console.error(`FAIL  ${fileArg}: ${(e as Error).message}`);
      return 1;
    }
    const errors: string[] = [];
    docs.forEach((arch, i) => {
      const label = docs.length > 1 ? `${fileArg}[#${i}]` : fileArg;
      const res = validateArchetype(arch, schema);
      for (const e of res.errors) errors.push(`${label}: ${e}`);
    });
    if (errors.length) {
      for (const e of errors) console.error(`FAIL  ${e}`);
      return 1;
    }
    console.log(`PASS  ${fileArg} — ${docs.length} archetype(s) valid`);
    return 0;
  }

  // No arg: validate the built-in roster + the default user dir, reporting the merged state.
  const { archetypes, errors } = loadAndMerge();
  const builtinCount = extractArchetypes(loadYaml(DEFAULT_BUILTINS)).length;
  const userCount = archetypes.length - builtinCount;
  console.log(`archetypes: ${archetypes.length} resolved (${builtinCount} built-in + ${userCount} user)`);
  if (errors.length) {
    for (const e of errors) console.error(`FAIL  ${e}`);
    return 1;
  }
  console.log("PASS  all archetypes valid; no id collisions");
  return 0;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(runCli(process.argv));
}
