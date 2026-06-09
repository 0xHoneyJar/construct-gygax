/**
 * expr.ts — restricted arithmetic interpreter for parametric `model:` formulas (cycle-005, FR-1).
 *
 * SDD §1.9 / §6, sprint.md Sprint B B.2/B.3. The ONE place untrusted-ish input (a `formula`
 * string from game-state YAML) enters the engine. Contained by a hand-written tokenizer +
 * recursive-descent parser + tree-walking evaluator over a whitelisted grammar:
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/' | '%') factor)*
 *   factor := '-' factor | primary
 *   primary:= number | name | func '(' expr (',' expr)* ')' | '(' expr ')'
 *
 * Allowed: numeric literals, the whitelisted identifier names (the declared variable, or the
 * model/metric names for a composed metric), parens, `+ - * / %`, and the functions
 * floor/ceil/abs (unary) and min/max (variadic, >=1 arg).
 *
 * NEVER uses `eval`, `new Function`, or member access. Any other token, character, or unknown
 * identifier throws `FormulaError` at compile time (fail-closed). Reuses the deny-by-default
 * posture of `scripts/lib/codegrounding/sandbox.ts` — NOT its child-process machinery (the
 * attack surface of a whitelisted single-pass grammar is tiny). See SDD §1.2 (rejected: F2 sandbox).
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

const UNARY_FUNCS = new Set(["floor", "ceil", "abs"]);
const VARIADIC_FUNCS = new Set(["min", "max"]);
const FUNCS = new Set([...UNARY_FUNCS, ...VARIADIC_FUNCS]);

type Tok =
  | { t: "num"; v: number }
  | { t: "name"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "%" }
  | { t: "lpar" }
  | { t: "rpar" }
  | { t: "comma" };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let j = i + 1;
      let seenDot = false;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || (src[j] === "." && !seenDot))) {
        if (src[j] === ".") seenDot = true;
        j++;
      }
      toks.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      let j = i + 1;
      while (
        j < src.length &&
        ((src[j] >= "a" && src[j] <= "z") ||
          (src[j] >= "A" && src[j] <= "Z") ||
          (src[j] >= "0" && src[j] <= "9") ||
          src[j] === "_")
      ) {
        j++;
      }
      toks.push({ t: "name", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "%") {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ t: "lpar" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ t: "rpar" });
      i++;
      continue;
    }
    if (c === ",") {
      toks.push({ t: "comma" });
      i++;
      continue;
    }
    // Deny-by-default: any other character (`.`, `[`, `]`, `=`, `;`, quotes, etc.) is rejected.
    throw new FormulaError(`illegal character '${c}' at position ${i} in formula`);
  }
  return toks;
}

// AST
type Node =
  | { k: "num"; v: number }
  | { k: "name"; v: string }
  | { k: "neg"; e: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "%"; l: Node; r: Node }
  | { k: "call"; fn: string; args: Node[] };

export type EvalFn = (env: Record<string, number>) => number;

/**
 * Compile a formula into an evaluator. `allowedNames` whitelists the identifiers the formula may
 * reference (the single declared variable for a model, or all model/metric names for a composed
 * metric). Throws FormulaError on any disallowed token or unknown identifier.
 */
export function compile(formula: string, allowedNames: string[]): EvalFn {
  if (typeof formula !== "string" || formula.trim() === "") {
    throw new FormulaError("empty formula");
  }
  const allowed = new Set(allowedNames);
  const toks = tokenize(formula);
  let pos = 0;

  const peek = (): Tok | undefined => toks[pos];
  const next = (): Tok => {
    const t = toks[pos++];
    if (!t) throw new FormulaError("unexpected end of formula");
    return t;
  };

  const parseExpr = (): Node => {
    let left = parseTerm();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
        next();
        left = { k: "bin", op: t.v, l: left, r: parseTerm() };
      } else break;
    }
    return left;
  };

  const parseTerm = (): Node => {
    let left = parseFactor();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) {
        next();
        left = { k: "bin", op: t.v, l: left, r: parseFactor() };
      } else break;
    }
    return left;
  };

  const parseFactor = (): Node => {
    const t = peek();
    if (t && t.t === "op" && t.v === "-") {
      next();
      return { k: "neg", e: parseFactor() };
    }
    if (t && t.t === "op" && t.v === "+") {
      next();
      return parseFactor();
    }
    return parsePrimary();
  };

  const parsePrimary = (): Node => {
    const t = next();
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "lpar") {
      const e = parseExpr();
      const close = next();
      if (close.t !== "rpar") throw new FormulaError("expected ')'");
      return e;
    }
    if (t.t === "name") {
      // function call?
      if (peek()?.t === "lpar") {
        if (!FUNCS.has(t.v)) throw new FormulaError(`unknown function '${t.v}'`);
        next(); // consume '('
        const args: Node[] = [parseExpr()];
        while (peek()?.t === "comma") {
          next();
          args.push(parseExpr());
        }
        const close = next();
        if (close.t !== "rpar") throw new FormulaError(`expected ')' closing ${t.v}(`);
        if (UNARY_FUNCS.has(t.v) && args.length !== 1) {
          throw new FormulaError(`${t.v}() takes exactly 1 argument, got ${args.length}`);
        }
        if (VARIADIC_FUNCS.has(t.v) && args.length < 1) {
          throw new FormulaError(`${t.v}() needs at least 1 argument`);
        }
        return { k: "call", fn: t.v, args };
      }
      // bare identifier → must be a whitelisted name (NOT a function, NOT unknown)
      if (FUNCS.has(t.v)) throw new FormulaError(`function '${t.v}' used without arguments`);
      if (!allowed.has(t.v)) throw new FormulaError(`unknown identifier '${t.v}' (not a declared variable)`);
      return { k: "name", v: t.v };
    }
    throw new FormulaError(`unexpected token in formula`);
  };

  const ast = parseExpr();
  if (pos !== toks.length) throw new FormulaError("trailing tokens after a complete expression");

  const evalNode = (n: Node, env: Record<string, number>): number => {
    switch (n.k) {
      case "num":
        return n.v;
      case "name": {
        const v = env[n.v];
        if (typeof v !== "number" || !Number.isFinite(v)) {
          throw new FormulaError(`name '${n.v}' is unbound or non-finite at evaluation`);
        }
        return v;
      }
      case "neg":
        return -evalNode(n.e, env);
      case "bin": {
        const l = evalNode(n.l, env);
        const r = evalNode(n.r, env);
        switch (n.op) {
          case "+": return l + r;
          case "-": return l - r;
          case "*": return l * r;
          case "/":
            if (r === 0) throw new FormulaError("division by zero");
            return l / r;
          case "%":
            if (r === 0) throw new FormulaError("modulo by zero");
            return l % r;
        }
      }
      // eslint-disable-next-line no-fallthrough
      case "call": {
        const a = n.args.map((arg) => evalNode(arg, env));
        switch (n.fn) {
          case "floor": return Math.floor(a[0]);
          case "ceil": return Math.ceil(a[0]);
          case "abs": return Math.abs(a[0]);
          case "min": return Math.min(...a);
          case "max": return Math.max(...a);
          default: throw new FormulaError(`unknown function '${n.fn}'`);
        }
      }
    }
  };

  return (env: Record<string, number>): number => {
    const out = evalNode(ast, env);
    if (!Number.isFinite(out)) throw new FormulaError("formula produced a non-finite value");
    return out;
  };
}

/** Validate a formula without evaluating it. Returns null if valid, else the FormulaError message. */
export function validateFormula(formula: string, allowedNames: string[]): string | null {
  try {
    compile(formula, allowedNames);
    return null;
  } catch (e) {
    return e instanceof FormulaError ? e.message : String(e);
  }
}
