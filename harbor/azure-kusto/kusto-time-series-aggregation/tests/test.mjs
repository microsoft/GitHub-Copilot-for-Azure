// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/* global console, process */

import { spawn } from "node:child_process";
import {
  access,
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const verifierConfig = Object.freeze({
  stimulusName: "Kusto time series aggregation",
  evalSpecPath: "/tests/_vally/eval.yaml",
  overlayPath: "/tests/_vally/workspace-overlay",
  overlayManifestPath: "/tests/_vally/workspace-overlay-paths",
  overlayFileCount: Number("0"),
  workspacePath: "/app",
  rewardDir: "/logs/verifier",
  outputDir: "/logs/artifacts",
  trajectoryDir: "/logs/agent",
  // In-image assets base for dest_root: "assets" fixtures (empty when none).
  // Baked outside the graded workspace; threaded to `vally grade --assets-dir`
  // and exported as EVALUATE_ASSETS so graders read trajectory.assetsDir.
  assetsDir: "",
  trajectoryArchiveDir: "/tmp/vally-harbor-trajectories",
  archivedTrajectoryCount: Number("0"),
});

async function defaultRunProcess(command, args, options) {
  const trajectoryInput = await open(options.stdinPath, "r");
  const gradedOutput = await open(options.stdoutPath, "w");
  try {
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: [trajectoryInput.fd, gradedOutput.fd, "inherit"],
      });
      child.once("error", rejectPromise);
      child.once("exit", (code) => resolvePromise(code ?? 1));
    });
  } finally {
    await Promise.all([trajectoryInput.close(), gradedOutput.close()]);
  }
}

async function defaultRunVersionProcess(command, args, options) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`Vally version command exited with code ${code ?? 1}`));
        return;
      }
      resolvePromise(output);
    });
  });
}

export function createVerifierRuntime({
  config = verifierConfig,
  runProcess = defaultRunProcess,
  runVersionProcess = defaultRunVersionProcess,
  log = console.log,
  platform = process.platform,
  env = process.env,
  execPath = process.execPath,
} = {}) {
  const rewardTextPath = join(config.rewardDir, "reward.txt");
  const rewardJsonPath = join(config.rewardDir, "reward.json");

  async function pathInfo(path) {
    try {
      return await lstat(path);
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
  }

  function resolveInside(root, child) {
    const resolvedRoot = resolve(root);
    const resolvedChild = resolve(resolvedRoot, child);
    const childRelative = relative(resolvedRoot, resolvedChild);
    if (
      childRelative === ".." ||
      childRelative.startsWith(`..${sep}`) ||
      isAbsolute(childRelative)
    ) {
      throw new Error(`Verifier overlay path escapes its root: ${child}`);
    }
    return resolvedChild;
  }

  async function rejectLinkedPath(path, message) {
    if ((await pathInfo(path))?.isSymbolicLink()) {
      throw new Error(message);
    }
  }

  function getRunPaths() {
    const outputDir = env.OUTPUT_DIR || config.outputDir;
    const trajectoryDir = env.OUTPUT_DIR
      ? join(env.OUTPUT_DIR, "trajectories")
      : config.trajectoryDir;
    return {
      outputDir,
      trajectoryPath: join(trajectoryDir, "trajectory.json"),
      mergedTrajectoryPath: join(outputDir, "merged-trajectory.json"),
      goldenPatchPath: join(trajectoryDir, "golden.patch"),
      gradedPath: join(outputDir, "graded.jsonl"),
    };
  }

  function startsWithSteps(candidate, prefix) {
    if (prefix.length > 0 && candidate.length <= prefix.length) return false;
    if (candidate.length < prefix.length) return false;
    for (let index = 0; index < prefix.length; index++) {
      if (!isDeepStrictEqual(candidate[index], prefix[index])) return false;
    }
    return true;
  }

  function renumberSteps(steps, offset = 0) {
    return steps.map((step, index) => ({ ...step, step_id: offset + index + 1 }));
  }

  function addFinalMetrics(left = {}, right = {}) {
    left ??= {};
    right ??= {};
    const totalFields = [
      "total_prompt_tokens",
      "total_completion_tokens",
      "total_cached_tokens",
      "total_cache_write_tokens",
      "total_cost_usd",
    ];
    const combined = { ...right };
    for (const field of totalFields) {
      const leftValue = typeof left[field] === "number" ? left[field] : 0;
      const rightValue = typeof right[field] === "number" ? right[field] : 0;
      if (leftValue !== 0 || rightValue !== 0) combined[field] = leftValue + rightValue;
    }
    return combined;
  }

  function mergeSubagentTrajectories(target, source) {
    const byId = new Map(target.map((trajectory) => [trajectory.trajectory_id, trajectory]));
    for (const trajectory of source) {
      const existing = byId.get(trajectory.trajectory_id);
      if (existing === undefined) {
        target.push(trajectory);
        byId.set(trajectory.trajectory_id, trajectory);
      } else if (!isDeepStrictEqual(existing, trajectory)) {
        throw new Error(`Conflicting subagent trajectory id: ${trajectory.trajectory_id}`);
      }
    }
  }

  async function readTrajectory(path, validateAtifTrajectory) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      throw new Error(`Failed to read ATIF trajectory at ${path}: ${String(error)}`, {
        cause: error,
      });
    }
    try {
      return validateAtifTrajectory(parsed);
    } catch (error) {
      throw new Error(`Invalid ATIF trajectory at ${path}: ${String(error)}`, {
        cause: error,
      });
    }
  }

  async function loadAtifValidator(vallyEntryScript) {
    if (vallyEntryScript === undefined) {
      throw new Error("Unable to locate the installed Vally CLI package for ATIF validation");
    }

    let coreEntry;
    try {
      coreEntry = createRequire(vallyEntryScript).resolve("@microsoft/vally");
    } catch (error) {
      throw new Error("Unable to resolve @microsoft/vally for ATIF validation", {
        cause: error,
      });
    }

    const vallyCore = await import(pathToFileURL(coreEntry).href);
    if (typeof vallyCore.validateAtifTrajectory !== "function") {
      throw new Error("Installed @microsoft/vally does not export validateAtifTrajectory");
    }
    return vallyCore.validateAtifTrajectory;
  }

  async function buildMergedTrajectory(currentPath, mergedPath, vallyEntryScript) {
    if (config.archivedTrajectoryCount === 0) return currentPath;

    const validateAtifTrajectory = await loadAtifValidator(vallyEntryScript);
    const paths = Array.from({ length: config.archivedTrajectoryCount }, (_value, index) =>
      join(config.trajectoryArchiveDir, `turn-${index + 1}.json`),
    );
    paths.push(currentPath);
    const trajectories = await Promise.all(
      paths.map((path) => readTrajectory(path, validateAtifTrajectory)),
    );

    let mergedSteps = [];
    let mergedFinalMetrics = {};
    const mergedSubagentTrajectories = [];
    for (const trajectory of trajectories) {
      const isCumulative = startsWithSteps(trajectory.steps, mergedSteps);
      if (isCumulative) {
        mergedSteps = renumberSteps(trajectory.steps);
        mergedFinalMetrics = { ...(trajectory.final_metrics ?? {}) };
        mergedSubagentTrajectories.length = 0;
      } else {
        mergedSteps.push(...renumberSteps(trajectory.steps, mergedSteps.length));
        mergedFinalMetrics = addFinalMetrics(mergedFinalMetrics, trajectory.final_metrics);
      }
      mergeSubagentTrajectories(mergedSubagentTrajectories, trajectory.subagent_trajectories ?? []);
    }

    const finalTrajectory = trajectories.at(-1);
    const merged = {
      ...finalTrajectory,
      steps: mergedSteps,
      final_metrics: {
        ...mergedFinalMetrics,
        total_steps: mergedSteps.length,
      },
      ...(mergedSubagentTrajectories.length > 0
        ? { subagent_trajectories: mergedSubagentTrajectories }
        : {}),
    };
    await writeFile(mergedPath, `${JSON.stringify(merged)}\n`, "utf8");
    return mergedPath;
  }

  async function prepareRewardDirectory() {
    try {
      await mkdir(config.rewardDir, { recursive: true });
    } catch {
      throw new Error("Failed to create reward directory");
    }

    try {
      await Promise.all([rm(rewardTextPath, { force: true }), rm(rewardJsonPath, { force: true })]);
    } catch {
      throw new Error("Failed to clear existing rewards");
    }
  }

  async function installVerifierOverlay() {
    if (config.overlayFileCount === 0) return;

    let manifest;
    try {
      manifest = await readFile(config.overlayManifestPath, "utf8");
    } catch {
      throw new Error("Verifier overlay manifest is missing or unreadable");
    }

    const verifierPaths = manifest.split(/\r?\n/).filter((path) => path.length > 0);
    if (verifierPaths.length !== config.overlayFileCount) {
      throw new Error("Verifier overlay manifest is incomplete");
    }

    await rejectLinkedPath(
      config.workspacePath,
      "Refusing to install verifier assets into a linked workspace root",
    );

    for (const verifierPath of verifierPaths) {
      const source = resolveInside(config.overlayPath, verifierPath);
      const target = resolveInside(config.workspacePath, verifierPath);
      const targetParent = dirname(target);
      const relativeParent = relative(resolve(config.workspacePath), targetParent);
      let component = resolve(config.workspacePath);

      if (relativeParent !== "") {
        for (const part of relativeParent.split(sep)) {
          component = join(component, part);
          const info = await pathInfo(component);
          // Windows reparse points (junctions/symlinks) cannot be removed as
          // safely as a POSIX symlink (a recursive delete can follow the reparse
          // point into its target), so fail closed there — regardless of how
          // lstat classifies the reparse point — rather than risk deleting or
          // writing through to an out-of-workspace target. (A symlinked
          // *workspace root* is already refused above.)
          if (info?.isSymbolicLink() && platform === "win32") {
            throw new Error(
              `Refusing verifier asset path with a reparse-point parent: ${verifierPath}`,
            );
          }
          // On POSIX, an agent-created symlink or regular file at a grader-dest
          // ancestor is authoritatively replaced without following it (`rm` on a
          // symlink unlinks the link) — matching core `stageGraderFile`.
          if (info && !info.isDirectory()) {
            await rm(component, { recursive: true, force: true });
          }
        }
      }

      // Same reparse-point safety at the final destination on Windows; on POSIX
      // the `rm(target)` below unlinks a leaf symlink without following it.
      if (platform === "win32") {
        const finalInfo = await pathInfo(target);
        if (finalInfo?.isSymbolicLink()) {
          throw new Error(
            `Refusing verifier asset destination that is a reparse point: ${verifierPath}`,
          );
        }
      }

      try {
        await rm(target, { recursive: true, force: true });
        await mkdir(targetParent, { recursive: true });
        await cp(source, target, { recursive: true, force: true, preserveTimestamps: true });
      } catch {
        throw new Error(`Failed to install verifier asset: ${verifierPath}`);
      }
    }
  }

  async function prepare() {
    await prepareRewardDirectory();
    const { outputDir, trajectoryPath } = getRunPaths();
    if (!env.OUTPUT_DIR) {
      await mkdir(outputDir, { recursive: true });
    }
    try {
      await access(trajectoryPath);
    } catch {
      throw new Error(`Error: trajectory file not found at ${trajectoryPath}`);
    }
    await installVerifierOverlay();
  }

  async function readVallyEntryScript(packageDir) {
    try {
      const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
      const binPath = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.vally;
      if (typeof binPath !== "string" || binPath.length === 0) return undefined;
      const entry = resolve(packageDir, binPath);
      await access(entry);
      return entry;
    } catch {
      return undefined;
    }
  }

  async function findVallyInstallation() {
    const pathValue = env.PATH ?? env.Path ?? "";
    for (const pathDir of pathValue.split(delimiter).filter(Boolean)) {
      const unquotedPathDir = pathDir.replace(/^"|"$/g, "");
      const packageEntry = await readVallyEntryScript(
        join(unquotedPathDir, "node_modules", "@microsoft", "vally-cli"),
      );
      if (packageEntry !== undefined) return { entry: packageEntry };

      if (platform !== "win32") {
        try {
          const launcher = await realpath(join(unquotedPathDir, "vally"));
          return /\.(?:c|m)?js$/.test(launcher) ? { entry: launcher } : { launcher };
        } catch (error) {
          if (error?.code !== "EACCES" && error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
            throw error;
          }
        }
      }
    }
    return undefined;
  }

  async function resolveVallyCommand(requireEntry = false) {
    if (!requireEntry && platform !== "win32") {
      return { command: "vally", prefixArgs: [], entry: undefined };
    }

    const installation = await findVallyInstallation();
    if (installation?.entry !== undefined) {
      return {
        command: execPath,
        prefixArgs: [installation.entry],
        entry: installation.entry,
      };
    }
    if (installation?.launcher !== undefined) {
      return { command: installation.launcher, prefixArgs: [], entry: undefined };
    }
    if (platform !== "win32") {
      return { command: "vally", prefixArgs: [], entry: undefined };
    }

    throw new Error("Error: unable to resolve the vally CLI entry point for node.exe");
  }

  function parseGradeArgs(args) {
    const usage = "Usage: test.mjs grade [--diff-file <path>] [--artifact-dir <path>]";
    let diffFile;
    let artifactDir;
    for (let index = 0; index < args.length; index += 1) {
      const flag = args[index];
      if (flag !== "--diff-file" && flag !== "--artifact-dir") throw new Error(usage);
      const value = args[index + 1];
      if (value === undefined || value === "") throw new Error(usage);
      if (flag === "--diff-file") diffFile = value;
      else artifactDir = value;
      index += 1;
    }
    return { diffFile, artifactDir };
  }

  async function grade(args) {
    const { diffFile: explicitDiffFile, artifactDir: artifactDirArg } = parseGradeArgs(args);
    // The artifact/output dir holds files the run produces *outside* the graded
    // workspace, so — unlike build-time assets — it is only known at grade time.
    // It arrives either as a --artifact-dir wrapper arg (Linux: the
    // verifierSetupScript sets ARTIFACT_DIR, mirroring DIFF_FILE) or the
    // ARTIFACT_DIR env var (cross-platform, incl. Windows where there is no
    // setup hook). Threaded to `vally grade --artifact-dir`, which stamps
    // trajectory.artifactDir (strict) so artifact-reading graders (custom-metrics,
    // program via EVALUATE_ARTIFACT_DIR, custom) load run outputs from there.
    const artifactDir =
      artifactDirArg !== undefined
        ? artifactDirArg
        : env.ARTIFACT_DIR && env.ARTIFACT_DIR !== ""
          ? env.ARTIFACT_DIR
          : undefined;
    const { trajectoryPath, mergedTrajectoryPath, goldenPatchPath, gradedPath } = getRunPaths();
    const vally = await resolveVallyCommand(config.archivedTrajectoryCount > 0);
    const gradeTrajectoryPath = await buildMergedTrajectory(
      trajectoryPath,
      mergedTrajectoryPath,
      vally.entry,
    );
    const diffFile =
      explicitDiffFile ?? ((await pathInfo(goldenPatchPath)) ? goldenPatchPath : undefined);
    const gradeArgs = [
      "grade",
      "--output",
      "jsonl",
      "--eval-spec",
      config.evalSpecPath,
      "--verbose",
      "--stimulus",
      config.stimulusName,
      "--workspace",
      config.workspacePath,
    ];
    if (diffFile !== undefined) gradeArgs.push("--diff-file", diffFile);
    if (artifactDir !== undefined) gradeArgs.push("--artifact-dir", artifactDir);
    // Assets are baked outside the workspace; stamp trajectory.assetsDir so
    // graders read them, and mirror EVALUATE_ASSETS into the grade env.
    if (config.assetsDir !== "") gradeArgs.push("--assets-dir", config.assetsDir);
    const gradeEnv = config.assetsDir !== "" ? { ...env, EVALUATE_ASSETS: config.assetsDir } : env;

    try {
      const version = (
        await runVersionProcess(vally.command, [...vally.prefixArgs, "--version"], {
          cwd: config.workspacePath,
          env: gradeEnv,
        })
      ).trim();
      log(version === "" ? "vally version unavailable" : `vally ${version}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`vally version unavailable: ${reason}`);
    }

    const gradeExit = await runProcess(vally.command, [...vally.prefixArgs, ...gradeArgs], {
      cwd: config.workspacePath,
      env: gradeEnv,
      stdinPath: gradeTrajectoryPath,
      stdoutPath: gradedPath,
    });

    if (gradeExit !== 0) return gradeExit;

    const gradedLines = (await readFile(gradedPath, "utf8"))
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    if (gradedLines.length !== 1) {
      throw new Error(`Expected one graded JSONL record, received ${gradedLines.length}`);
    }

    let score;
    try {
      score = JSON.parse(gradedLines[0])?.gradeResult?.score;
    } catch (error) {
      throw new Error(`Failed to extract score from graded JSONL: ${String(error)}`, {
        cause: error,
      });
    }
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error(`Failed to extract score from graded JSONL: ${String(score)}`);
    }

    await writeFile(rewardTextPath, `${score}\n`, "ascii");
    return 0;
  }

  async function main(args) {
    const [command, ...commandArgs] = args;
    if (command === "prepare") {
      await prepare();
      return 0;
    }
    if (command === "grade") {
      return grade(commandArgs);
    }
    if (command !== undefined) {
      throw new Error(`Unknown verifier command: ${command}`);
    }
    await prepare();
    return grade([]);
  }

  return { grade, installVerifierOverlay, main, prepare, resolveVallyCommand };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = await createVerifierRuntime().main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
