#!/usr/bin/env node

/**
 * Waza eval runner bridge script.
 *
 * Hybrid model:
 *   - If tests/{skill}/eval/eval.yaml exists → use committed eval (customized)
 *   - Otherwise → auto-generate from plugin/skills/{skill}/SKILL.md into a temp dir
 *
 * Usage:
 *   npm run waza -- azure-prepare               # uses committed eval (customized)
 *   npm run waza -- azure-storage                # auto-generates from SKILL.md
 *   npm run waza:live -- azure-prepare           # copilot-sdk executor (real agent)
 *   npm run waza -- azure-prepare --cache        # cached re-runs
 *   npm run waza -- azure-prepare --parallel     # parallel task execution
 *   npm run waza -- --all                        # run all skills (committed + generated)
 *
 * Resolves the eval suite path for a given skill name and invokes waza CLI.
 * Falls back to `azd waza` if bare `waza` is not on PATH.
 */

import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(testsDir, "..");
const skillsDir = path.join(repoRoot, "plugin", "skills");

// Parse args: first positional = skill name, rest forwarded to waza
const rawArgs = process.argv.slice(2);
let skillName = null;
let runAll = false;
let executor = null;
const extraArgs = [];

for (const arg of rawArgs) {
  if (arg === "--all") {
    runAll = true;
  } else if (arg === "--executor" || arg === "-e") {
    extraArgs.push(arg);
  } else if (arg.startsWith("--executor=")) {
    executor = arg.split("=")[1];
    extraArgs.push(arg);
  } else if (!arg.startsWith("-") && !skillName) {
    skillName = arg;
  } else {
    extraArgs.push(arg);
  }
}

// Detect waza CLI
function findWaza() {
  try {
    execSync("which waza", { stdio: "ignore" });
    return ["waza"];
  } catch {
    try {
      execSync("which azd", { stdio: "ignore" });
      return ["azd", "waza"];
    } catch {
      return null;
    }
  }
}

const wazaBin = findWaza();

if (!wazaBin) {
  console.error("Error: Neither 'waza' nor 'azd waza' found on PATH.");
  console.error("");
  console.error("Install waza:");
  console.error("  # Via azd extension");
  console.error("  azd ext source add -n waza -t url -l https://raw.githubusercontent.com/spboyer/waza/main/registry.json");
  console.error("  azd ext install microsoft.azd.waza");
  console.error("");
  console.error("  # Or via Go");
  console.error("  go install github.com/spboyer/waza/cmd/waza@latest");
  process.exit(2);
}

/**
 * List all skills that have a committed eval suite.
 */
function getCommittedEvalSkills() {
  return fs.readdirSync(testsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .filter(d => fs.existsSync(path.join(testsDir, d.name, "eval", "eval.yaml")))
    .map(d => d.name);
}

/**
 * List all skills that exist in plugin/skills/ (have a SKILL.md).
 */
function getAllSkills() {
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => fs.existsSync(path.join(skillsDir, d.name, "SKILL.md")))
    .map(d => d.name);
}

/**
 * Auto-generate a waza eval suite from SKILL.md into a temp directory.
 * Returns the path to the generated eval.yaml, or null on failure.
 */
function generateEval(skill) {
  const skillMd = path.join(skillsDir, skill, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    console.error(`  No SKILL.md found at ${skillMd}`);
    return null;
  }

  const tmpDir = path.join(os.tmpdir(), `waza-gen-${skill}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`  Generating eval from ${path.relative(repoRoot, skillMd)} → ${tmpDir}`);

  const genArgs = [...wazaBin.slice(1), "generate", skillMd, "-d", tmpDir];
  const result = spawnSync(wazaBin[0], genArgs, {
    stdio: "inherit",
    cwd: repoRoot,
    env: { ...process.env }
  });

  if (result.status !== 0) {
    console.error(`  waza generate failed for ${skill} (exit ${result.status})`);
    return null;
  }

  const evalYaml = path.join(tmpDir, "eval.yaml");
  if (!fs.existsSync(evalYaml)) {
    console.error(`  Generated eval.yaml not found at ${evalYaml}`);
    return null;
  }

  return { evalYaml, fixturesDir: path.join(tmpDir, "fixtures"), tmpDir };
}

/**
 * Run waza for a single skill. Returns the exit code.
 */
function runSkill(skill) {
  const committedEval = path.join(testsDir, skill, "eval", "eval.yaml");
  const committedFixtures = path.join(testsDir, skill, "eval", "fixtures");
  const isCommitted = fs.existsSync(committedEval);

  let evalYaml, fixturesDir;

  if (isCommitted) {
    console.log(`\n⬢ ${skill} (committed eval)`);
    evalYaml = committedEval;
    fixturesDir = fs.existsSync(committedFixtures) ? committedFixtures : null;
  } else {
    console.log(`\n⬡ ${skill} (auto-generating from SKILL.md)`);
    const gen = generateEval(skill);
    if (!gen) return 2;
    evalYaml = gen.evalYaml;
    fixturesDir = fs.existsSync(gen.fixturesDir) ? gen.fixturesDir : null;
  }

  // Build waza run command
  const wazaArgs = [...wazaBin.slice(1), "run", evalYaml];

  if (fixturesDir) {
    wazaArgs.push("--context-dir", fixturesDir);
  }

  if (!extraArgs.includes("--quiet") && !extraArgs.includes("-q")) {
    wazaArgs.push("-v");
  }

  wazaArgs.push(...extraArgs);

  console.log(`  Running: ${wazaBin[0]} ${wazaArgs.join(" ")}\n`);

  const result = spawnSync(wazaBin[0], wazaArgs, {
    stdio: "inherit",
    cwd: repoRoot,
    env: { ...process.env }
  });

  return result.status ?? 1;
}

// --- Main ---

if (!skillName && !runAll) {
  const committed = getCommittedEvalSkills();
  const all = getAllSkills();
  const generatable = all.filter(s => !committed.includes(s));

  console.error("Usage: npm run waza -- <skill-name> [--cache] [--parallel] [--verbose]");
  console.error("       npm run waza -- --all");
  console.error("       npm run waza:live -- <skill-name>");
  console.error("");

  if (committed.length > 0) {
    console.error("Committed eval suites (customized):");
    for (const s of committed) console.error(`  ⬢ ${s}`);
  }

  if (generatable.length > 0) {
    console.error("\nAuto-generatable from SKILL.md:");
    for (const s of generatable) console.error(`  ⬡ ${s}`);
  }

  process.exit(2);
}

if (runAll) {
  // Run committed first, then generate for the rest
  const committed = getCommittedEvalSkills();
  const all = getAllSkills();
  const generatable = all.filter(s => !committed.includes(s));

  console.log(`Running evals for ${committed.length} committed + ${generatable.length} generated skills\n`);

  let failures = 0;
  for (const skill of [...committed, ...generatable]) {
    const code = runSkill(skill);
    if (code !== 0) failures++;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Results: ${committed.length + generatable.length - failures} passed, ${failures} failed`);
  process.exit(failures > 0 ? 1 : 0);
} else {
  process.exit(runSkill(skillName));
}
