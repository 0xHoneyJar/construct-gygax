/**
 * static-analyzer.ts — F1 Static Analyzer (Sprint 2, Task 2.1)
 *
 * grimoires/loa/sprint.md:L144; SDD §1.4, §3.2, §5.4.
 *
 * Extracts, from a target TS engine (+ its JSON tables):
 *   - `numbers`: literal numeric values, each cited (file:line)
 *   - `loops`:  mechanic→mechanic CALL edges — asserted ONLY when the callee resolves (via the
 *               TS type-checker) to another named engine function. This is the certainty gate.
 *   - `untraceable`: sites we can SEE but will NOT assert (reactive store / event dispatch /
 *               dynamic dispatch). Recorded, never promoted to a loop (prd.md:L178-179, L251-252).
 *
 * Precision over recall: when in doubt, stay silent. A wrong structural claim is worse than a
 * missing one (NOTES.md F1; SDD §1.4 "Key constraint").
 *
 * Runs under tsx (parent/analysis side). Uses the TypeScript Compiler API (sdd.md:L271).
 */
import ts from "typescript";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";
import { execFileSync } from "node:child_process";

export interface NumberFact {
  name: string;
  value: number;
  source: string; // "relpath:line"
  kind: "literal" | "json";
  /**
   * FR-3 (cycle-005): inferred engine-tunability of this value, when a code signal is present.
   * `engine-default` = a sample/config value an adopter replaces (DEFAULT_*-style const).
   * `structural` = a number hardcoded inside the core sim loop (an engine invariant).
   * ADDITIVE and conservative: left `undefined` (untagged) when no clear signal — never
   *   changes the set of facts, so downstream drift output is unaffected for untagged repos.
   */
  tunability?: "engine-default" | "structural";
}

/**
 * FR-3 (cycle-006 real-code hardening): a const whose value is a *formula* (a numeric expression,
 * not a literal) — e.g. `const enemyDEF = floor((depth-9)/4)`. These are the engine's tuning
 * surface and were previously invisible to F1 (only literals were captured). Kept SEPARATE from
 * `numbers` so drift reconciliation (which compares literal values) is unaffected.
 */
export interface FormulaFact {
  name: string;
  formula: string; // the initializer text, verbatim
  source: string; // "relpath:line"
  tunability?: "engine-default" | "structural";
}

/** FR-3: const names that read as replaceable sample/config values → engine-default. */
const ENGINE_DEFAULT_NAME = /^(DEFAULT|SAMPLE|EXAMPLE|DEMO|STARTER|PLACEHOLDER)_|_DEFAULTS?$/i;
/** FR-3: function names that read as the core simulation loop → numbers inside them are structural. */
const SIM_LOOP_FN = /(simulate|^sim$|sim[A-Z_]|update|tick|step|resolve|combat|loop|attack|damage|apply|advance)/i;

/** FR-3 inference: engine-default by name, else structural if hardcoded in a sim-loop fn, else untagged. */
function inferTunability(name: string, enclosingFn: string | null): NumberFact["tunability"] {
  if (ENGINE_DEFAULT_NAME.test(name)) return "engine-default";
  if (enclosingFn && SIM_LOOP_FN.test(enclosingFn)) return "structural";
  return undefined;
}
export interface LoopEdge {
  from: string;
  to: string;
  edge: "call";
  source: string;
  confidence: "certain";
}
export interface UntraceableSite {
  site: string; // "relpath:line"
  reason: string;
}
export interface StructuralMap {
  repo: string;
  commit: string;
  numbers: NumberFact[];
  formulas: FormulaFact[];
  loops: LoopEdge[];
  untraceable: UntraceableSite[];
}

/** Property names that signal reactive/event wiring we deliberately do NOT trace as call edges. */
const DYNAMIC_DISPATCH_NAMES = new Set([
  "subscribe",
  "set",
  "update",
  "dispatch",
  "emit",
  "on",
  "once",
  "addEventListener",
  "addListener",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", ".beads", "__fixtures__", "dist", "build"]);

function walkFiles(root: string, exts: Set<string>, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const full = join(root, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.has(extname(full))) {
      if (full.endsWith(".d.ts") || full.endsWith(".test.ts")) continue;
      out.push(full);
    }
  }
}

function gitCommit(repoPath: string): string {
  try {
    return execFileSync("git", ["-C", repoPath, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/** numeric literal, including negatives written as `-5`. */
function numericValue(node: ts.Expression): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  return null;
}

function loc(sf: ts.SourceFile, node: ts.Node, repoPath: string): string {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `${relative(repoPath, sf.fileName)}:${line + 1}`;
}

// ---- FR-3 real-code hardening: detect numeric *formula* initializers (not plain literals) ----
const ARITH_OPS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);

function hasNumericLiteral(node: ts.Node): boolean {
  if (ts.isNumericLiteral(node)) return true;
  let found = false;
  node.forEachChild((c) => {
    if (!found && hasNumericLiteral(c)) found = true;
  });
  return found;
}

/** A `Math.floor(...)` / `floor(...)`-style call (the math we'd express in a `model:` formula). */
function isMathCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const c = node.expression;
  if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === "Math") return true;
  if (ts.isIdentifier(c) && /^(floor|ceil|round|min|max|abs|sqrt|pow)$/i.test(c.text)) return true;
  return false;
}

/** Is `node` a numeric *formula* — an arithmetic/conditional/math expression with a numeric literal? */
function isNumericFormula(node: ts.Node): boolean {
  if (ts.isNumericLiteral(node)) return false; // a plain literal — captured as a NumberFact, not a formula
  const kindOk =
    (ts.isBinaryExpression(node) && ARITH_OPS.has(node.operatorToken.kind)) ||
    ts.isConditionalExpression(node) ||
    isMathCall(node) ||
    (ts.isParenthesizedExpression(node) && isNumericFormula(node.expression));
  return kindOk && hasNumericLiteral(node);
}

/**
 * Analyze a repo into a StructuralMap. `repoPath` is the engine root (or a subdir like src/).
 */
export function analyze(repoPath: string): StructuralMap {
  const tsFiles: string[] = [];
  walkFiles(repoPath, new Set([".ts", ".tsx"]), tsFiles);

  const program = ts.createProgram(tsFiles, {
    allowJs: false,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();

  const numbers: NumberFact[] = [];
  const formulas: FormulaFact[] = [];
  const loops: LoopEdge[] = [];
  const untraceable: UntraceableSite[] = [];
  const seenLoop = new Set<string>();
  const seenUntraceable = new Set<string>();

  // ---- Pass 1: collect top-level named functions (declaration node -> name) ----
  // These are the only nodes a call edge may resolve TO; certainty comes from the checker.
  const declToName = new Map<ts.Node, string>();

  for (const fileName of tsFiles) {
    const sf = program.getSourceFile(fileName);
    if (!sf) continue;
    sf.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        declToName.set(node, node.name.text);
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (
            ts.isIdentifier(d.name) &&
            d.initializer &&
            (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
          ) {
            declToName.set(d, d.name.text);
          }
        }
      }
    });
  }

  const resolveToTrackedName = (expr: ts.Expression): string | null => {
    if (!ts.isIdentifier(expr)) return null;
    let sym = checker.getSymbolAtLocation(expr);
    if (!sym) return null;
    if (sym.flags & ts.SymbolFlags.Alias) {
      try {
        sym = checker.getAliasedSymbol(sym);
      } catch {
        /* keep original */
      }
    }
    for (const decl of sym.declarations ?? []) {
      if (declToName.has(decl)) return declToName.get(decl)!;
    }
    return null;
  };

  // ---- Pass 2: numbers (all files) + call edges / untraceable (within tracked fn bodies) ----
  for (const fileName of tsFiles) {
    const sf = program.getSourceFile(fileName);
    if (!sf) continue;

    // The DIRECT numeric properties of a `const DEFAULT_*/config = { ... }` object — these are the
    // tunable params (e.g. DEFAULT_STATS.maxHP). Deeply-nested numbers (sample-data coordinates in a
    // demo level) are deliberately NOT included, to avoid over-tagging bulk content (FR-3 hardening).
    const directDefaultProps = new Set<ts.Node>();
    const collectDefaultProps = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        ENGINE_DEFAULT_NAME.test(node.name.text) &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        for (const p of node.initializer.properties) {
          if (ts.isPropertyAssignment(p) && numericValue(p.initializer) !== null) directDefaultProps.add(p);
        }
      }
      ts.forEachChild(node, collectDefaultProps);
    };
    collectDefaultProps(sf);

    // `enclosingFn` carries the nearest sim-loop fn name down the walk (FR-3).
    const visitForNumbers = (node: ts.Node, enclosingFn: string | null): void => {
      let fnHere = enclosingFn;
      if (ts.isFunctionDeclaration(node) && node.name) {
        fnHere = node.name.text;
      } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
        fnHere = node.name.text;
      } else if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        fnHere = node.name.text;
      }

      // const NAME = <number literal | numeric formula>
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const v = numericValue(node.initializer);
        if (v !== null) {
          const fact: NumberFact = { name: node.name.text, value: v, source: loc(sf, node.name, repoPath), kind: "literal" };
          const t = inferTunability(node.name.text, enclosingFn);
          if (t) fact.tunability = t;
          numbers.push(fact);
        } else if (isNumericFormula(node.initializer)) {
          // The tuning surface: a value defined by a formula (previously invisible to F1).
          const ff: FormulaFact = { name: node.name.text, formula: node.initializer.getText(sf), source: loc(sf, node.name, repoPath) };
          const t = inferTunability(node.name.text, enclosingFn);
          if (t) ff.tunability = t;
          formulas.push(ff);
        }
      }
      // { name: <number> } — tagged engine-default only if a DIRECT property of a DEFAULT_* config object.
      if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
        const v = numericValue(node.initializer);
        if (v !== null) {
          const key = node.name.text;
          const fact: NumberFact = { name: key, value: v, source: loc(sf, node.name, repoPath), kind: "literal" };
          const t = inferTunability(key, enclosingFn) ?? (directDefaultProps.has(node) ? "engine-default" : undefined);
          if (t) fact.tunability = t;
          numbers.push(fact);
        }
      }
      ts.forEachChild(node, (c) => visitForNumbers(c, fnHere));
    };
    visitForNumbers(sf, null);

    // Edges: walk each tracked function body, classify calls.
    const classifyCalls = (fromName: string, body: ts.Node): void => {
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          const toName = resolveToTrackedName(callee);
          if (toName) {
            const source = loc(sf, node, repoPath);
            const k = `${fromName}->${toName}@${source}`;
            if (!seenLoop.has(k)) {
              seenLoop.add(k);
              loops.push({ from: fromName, to: toName, edge: "call", source, confidence: "certain" });
            }
          } else if (
            ts.isPropertyAccessExpression(callee) &&
            DYNAMIC_DISPATCH_NAMES.has(callee.name.text)
          ) {
            const site = loc(sf, node, repoPath);
            if (!seenUntraceable.has(site)) {
              seenUntraceable.add(site);
              untraceable.push({ site, reason: `reactive/event dispatch (.${callee.name.text})` });
            }
          } else if (ts.isElementAccessExpression(callee)) {
            const site = loc(sf, node, repoPath);
            if (!seenUntraceable.has(site)) {
              seenUntraceable.add(site);
              untraceable.push({ site, reason: "dynamic dispatch (computed member call)" });
            }
          }
          // calls to library/unknown identifiers: stay SILENT (not our wiring).
        }
        ts.forEachChild(node, visit);
      };
      visit(body);
    };

    sf.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        classifyCalls(node.name.text, node.body);
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (
            ts.isIdentifier(d.name) &&
            d.initializer &&
            (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) &&
            d.initializer.body
          ) {
            classifyCalls(d.name.text, d.initializer.body);
          }
        }
      }
    });
  }

  // ---- Pass 3: numbers from JSON tables ----
  const jsonFiles: string[] = [];
  walkFiles(repoPath, new Set([".json"]), jsonFiles);
  for (const fileName of jsonFiles) {
    if (basename(fileName) === "package.json" || basename(fileName) === "tsconfig.json") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(fileName, "utf8"));
    } catch {
      continue;
    }
    const rel = relative(repoPath, fileName);
    const walkJson = (val: unknown, path: string): void => {
      if (typeof val === "number") {
        numbers.push({ name: path, value: val, source: rel, kind: "json" });
      } else if (val && typeof val === "object") {
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          walkJson(v, path ? `${path}.${k}` : k);
        }
      }
    };
    walkJson(parsed, "");
  }

  return {
    repo: basename(repoPath),
    commit: gitCommit(repoPath),
    numbers,
    formulas,
    loops,
    untraceable,
  };
}

// CLI: `echo '{"repoPath":"..."}' | npx tsx scripts/lib/codegrounding/static-analyzer.ts`
// or   `npx tsx scripts/lib/codegrounding/static-analyzer.ts <repoPath>`
if (process.argv[1]?.endsWith("static-analyzer.ts")) {
  const arg = process.argv[2];
  const run = (repoPath: string) => {
    process.stdout.write(JSON.stringify(analyze(repoPath), null, 2) + "\n");
  };
  if (arg) {
    run(arg);
  } else {
    let input = "";
    process.stdin.on("data", (d) => (input += d));
    process.stdin.on("end", () => run(JSON.parse(input || "{}").repoPath ?? process.cwd()));
  }
}
