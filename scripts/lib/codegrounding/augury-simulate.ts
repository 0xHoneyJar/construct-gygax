/**
 * augury-simulate.ts — /augury --simulate entrypoint (Sprint 3, Task 3.2 wiring)
 *
 * grimoires/loa/sprint.md:L198; SDD §4.2 (the approval-gate UX).
 *
 * Two explicit phases so the approval gate is structurally unavoidable:
 *
 *   propose:  `npx tsx augury-simulate.ts propose <repoPath>`
 *             → detects the gygaxDriver (refuses + spec if absent), analyzes the engine,
 *               prints a ScenarioSpec JSON with approvedBy UNSET. The skill shows this to the
 *               human for approval/edit.
 *
 *   run:      `<approved-spec-json> | npx tsx augury-simulate.ts run <repoPath> [outDir]`
 *             → reads the approved spec on stdin; runSimulation() refuses unless approvedBy is
 *               set; on success writes a labeled SimDistribution report and prints its path.
 *
 * The skill must NOT fabricate `approvedBy` — it is the human's explicit act (prd.md:L189).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "./static-analyzer.ts";
import { detectDriver } from "./driver-detect.ts";
import {
  proposeScenario,
  runSimulation,
  renderSimDistributionMarkdown,
  type ScenarioSpec,
} from "./sim-orchestrator.ts";

function readStdin(): Promise<string> {
  return new Promise((res) => {
    let buf = "";
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", () => res(buf));
  });
}

async function main(): Promise<void> {
  const [, , cmd, repoPath, outDir] = process.argv;
  if (!cmd || !repoPath) {
    process.stderr.write("usage: augury-simulate.ts <propose|run> <repoPath> [outDir]\n");
    process.exit(2);
  }

  const det = detectDriver(repoPath);
  if (!det.found) {
    // Refuse + print the exact contract — never a silent fallback for a digital engine.
    process.stderr.write(det.spec + "\n");
    process.exit(1);
  }

  if (cmd === "propose") {
    const spec = proposeScenario(analyze(repoPath));
    process.stdout.write(JSON.stringify(spec, null, 2) + "\n");
    return;
  }

  if (cmd === "run") {
    const spec = JSON.parse(await readStdin()) as ScenarioSpec;
    // runSimulation enforces the gate (throws ScenarioNotApprovedError if approvedBy unset).
    const dist = await runSimulation(spec, { repoPath, driverModule: det.module });
    const md = renderSimDistributionMarkdown(dist);
    const dest = outDir ?? "grimoires/gygax/balance-reports";
    mkdirSync(dest, { recursive: true });
    const safeLabel = spec.label.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
    const reportPath = join(dest, `sim-${safeLabel}.md`);
    writeFileSync(reportPath, md, "utf8");
    process.stdout.write(`sim report written: ${reportPath}\n`);
    process.stdout.write(`n=${dist.n} mean=${dist.stats.mean} p50=${dist.stats.p50} p90=${dist.stats.p90}\n`);
    return;
  }

  process.stderr.write(`unknown command: ${cmd}\n`);
  process.exit(2);
}

void main();
