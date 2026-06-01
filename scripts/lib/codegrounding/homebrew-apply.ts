/**
 * homebrew-apply.ts — /homebrew --apply entrypoint (Sprint 4, Task 4.3)
 *
 * grimoires/loa/sprint.md:L259; SDD §1.5 (F4 data flow), §4.3.
 *
 * Composes F1 + the Patch Emitter: for each proposed change it computes `traced` from F1's real
 * trace of the repo, emits a unified diff (logic diffs gated by certainty; data/JSON unrestricted),
 * validates EVERY diff with `git apply --check`, and prints the diffs for human review.
 *
 * It NEVER writes to source and NEVER applies a patch — application is always a separate
 * human/Arneson step (prd.md:L202,L205). Output is text only.
 *
 * Input (stdin JSON):
 *   { "repoPath": "<engine root>",
 *     "targets": [ { "file": "src/x.ts", "kind": "logic"|"data",
 *                    "oldText": "...", "newText": "..." }, ... ] }
 */
import { analyze } from "./static-analyzer.ts";
import {
  emitPatch,
  validatePatch,
  isLogicTraced,
  UntracedLogicPatchError,
  type PatchTarget,
} from "./patch-emitter.ts";

interface ApplyInput {
  repoPath: string;
  targets: PatchTarget[];
}

function readStdin(): Promise<string> {
  return new Promise((res) => {
    let buf = "";
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", () => res(buf));
  });
}

async function main(): Promise<void> {
  const input = JSON.parse((await readStdin()) || "{}") as ApplyInput;
  if (!input.repoPath || !Array.isArray(input.targets)) {
    process.stderr.write('expected {"repoPath","targets":[...]} on stdin\n');
    process.exit(2);
  }

  const map = analyze(input.repoPath);
  let emitted = 0;
  let refused = 0;

  for (const target of input.targets) {
    // Logic diffs gated by F1's trace; data diffs unrestricted.
    const traced = target.kind === "logic" ? isLogicTraced(map, target.file) : true;
    let diff: string;
    try {
      diff = emitPatch(target, traced).diff;
    } catch (e) {
      if (e instanceof UntracedLogicPatchError) {
        refused++;
        process.stdout.write(`\n# REFUSED: ${target.file}\n${e.message}\n`);
        continue;
      }
      throw e;
    }
    if (!diff.trim()) {
      process.stdout.write(`\n# ${target.file}: no change (old === new)\n`);
      continue;
    }
    // Validate before presenting (R-8). A diff that won't apply is a bug, not a suggestion.
    const ok = validatePatch(diff, input.repoPath);
    if (!ok) {
      process.stdout.write(
        `\n# WARNING: ${target.file}: diff did NOT pass 'git apply --check' — not presenting.\n`,
      );
      continue;
    }
    emitted++;
    process.stdout.write(
      `\n# Suggested diff for ${target.file} (${target.kind}, ` +
        `${target.kind === "logic" ? `traced=${traced}` : "data"}). ` +
        `Apply yourself: \`git apply\`. Gygax will not apply it.\n`,
    );
    process.stdout.write(diff.endsWith("\n") ? diff : diff + "\n");
  }

  process.stderr.write(`\nemitted=${emitted} refused=${refused}\n`);
}

void main();
