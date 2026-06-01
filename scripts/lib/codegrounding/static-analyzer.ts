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

    const visitForNumbers = (node: ts.Node): void => {
      // const NAME = <number>
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const v = numericValue(node.initializer);
        if (v !== null) {
          numbers.push({ name: node.name.text, value: v, source: loc(sf, node.name, repoPath), kind: "literal" });
        }
      }
      // { name: <number> }
      if (
        ts.isPropertyAssignment(node) &&
        (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      ) {
        const v = numericValue(node.initializer);
        if (v !== null) {
          const key = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
          numbers.push({ name: key, value: v, source: loc(sf, node.name, repoPath), kind: "literal" });
        }
      }
      ts.forEachChild(node, visitForNumbers);
    };
    visitForNumbers(sf);

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
