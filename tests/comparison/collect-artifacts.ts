/**
 * collect-artifacts.ts — download comparison test trajectories from Azure Storage.
 *
 * Usage: tsx collect-artifacts.ts <input.json>
 *
 * Exit codes:
 *   0 = success (all runs collected)
 *   1 = a step failed (missing dependency, Azure error, or no blobs found)
 *   2 = usage/argument error
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { CompareRunOutput as CompareRunOutput } from "./run-compare";

const STORAGE_ACCOUNT = "strdashboarddevveobvk";
const CONTAINER = "manual-integration-reports";
const OUTPUT_ROOT = "comparison-artifacts";

function usage(): void {
  console.log(`Usage: collect-artifacts.ts <input.json>

Exit codes:
  0 = success (all runs collected)
  1 = a step failed (missing dependency, Azure error, or no blobs found)
  2 = usage/argument error`);
}

function encodeBranchName(branch: string) {
  return branch.replaceAll("/", "_");
}

function run(): void {
  const args = process.argv.slice(2);

  if (args.length === 1 && (args[0] === "-h" || args[0] === "--help")) {
    usage();
    process.exit(0);
  }

  if (args.length !== 1) {
    console.error(
      "Error: expected exactly one argument (path to the input JSON file)."
    );
    usage();
    process.exit(2);
  }

  const inputFile = args[0];

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: input file not found: ${inputFile}`);
    process.exit(2);
  }

  // Check for required commands
  for (const cmd of ["jq", "az"]) {
    try {
      execSync(`command -v ${cmd}`, {
        stdio: "ignore",
      });
    } catch {
      console.error(`Error: required command '${cmd}' is not installed.`);
      process.exit(1);
    }
  }

  let input: CompareRunOutput;
  try {
    const content = fs.readFileSync(inputFile, "utf-8");
    input = JSON.parse(content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`Error: failed to parse input JSON: ${msg}`);
    process.exit(2);
  }

  const date = input.date || "";
  const skillName = input.skill?.name || "";

  if (!date || !skillName) {
    console.error("Error: input JSON must define 'date' and 'skill.name'.");
    process.exit(2);
  }

  if (!input.results || input.results.length === 0) {
    console.error("Error: input JSON contains no runs.");
    process.exit(2);
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_ROOT)) {
    fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  }

  let failed = 0;

  for (const result of input.results) {
    const branch = result.branch;
    const runs = result.runs;
    for (const run of runs) {
      const model: string = run.model;
      const withSkill: boolean = run.withSkill;
      const runUrl: string = run.run;

      if (!model) continue;

      // Extract run ID from GitHub Actions URL
      const runId = runUrl.split("/").pop();
      if (!runId) {
        console.error(`Error: could not extract run id from URL: ${runUrl}`);
        failed = 1;
        continue;
      }

      const skillSuffix = withSkill ? "with-skill" : "without-skill";

      // Discover stimuli for this run
      const prefix = `${date}/${runId}/${skillName}/${skillName}_`;
      console.log(
        `Discovering stimuli for run ${runId} under ${CONTAINER}/${prefix} ...`
      );

      let discoveryResult: string;
      try {
        const cmd = `az storage blob list --account-name "${STORAGE_ACCOUNT}" --container-name "${CONTAINER}" --prefix "${prefix}" --auth-mode login --query "[?ends_with(name, '.md')].name" -o tsv`;
        discoveryResult = execSync(cmd, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"]
        }) as string;
      } catch {
        console.error(`Error: failed to discover blobs for run ${runId}.`);
        failed = 1;
        continue;
      }

      // Extract unique stimuli names from blob paths
      const blobLines = discoveryResult.trim().split("\n").filter((line: string) => line);
      const stimuliSet: Set<string> = new Set();

      for (const blob of blobLines) {
        const regexPattern = new RegExp(`/${skillName}_([^/]+)/`);
        const match = blob.match(regexPattern);
        if (match) {
          stimuliSet.add(match[1]);
        }
      }

      if (stimuliSet.size === 0) {
        console.error(
          `Warning: no stimuli directories discovered for run ${runId}`
        );
        continue;
      }

      console.log(
        `Discovered stimuli for run ${runId}: ${Array.from(stimuliSet).join(", ")}`
      );

      for (const stimuliPart of stimuliSet) {
        const stimuliOutputDir = path.join(
          OUTPUT_ROOT,
          encodeBranchName(branch),
          stimuliPart,
          `${model}-${skillSuffix}`
        );
        const blobPrefix = `${date}/${runId}/${skillName}/${skillName}_${stimuliPart}/agent-metadata-`;

        console.log(
          `Listing blobs for stimuli '${stimuliPart}' in run ${runId} ...`
        );

        let blobs: string;
        try {
          const cmd = `az storage blob list --account-name "${STORAGE_ACCOUNT}" --container-name "${CONTAINER}" --prefix "${blobPrefix}" --auth-mode login --query "[?ends_with(name, '.md')].name" -o tsv`;
          blobs = execSync(cmd, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"]
          }) as string;
        } catch {
          console.error(
            `Error: failed to list blobs for run ${runId}, stimuli ${stimuliPart}.`
          );
          failed = 1;
          continue;
        }

        const blobList = blobs.trim().split("\n").filter((line: string) => line);
        if (blobList.length === 0) {
          console.error(
            `Warning: no trajectory blobs found for run ${runId}, stimuli ${stimuliPart}.`
          );
          continue;
        }

        // Create output directory
        if (!fs.existsSync(stimuliOutputDir)) {
          fs.mkdirSync(stimuliOutputDir, { recursive: true });
        }

        for (const blob of blobList) {
          const fileName = path.basename(blob);
          console.log(`  downloading ${fileName} -> ${stimuliOutputDir}`);

          try {
            const outputPath = path.join(stimuliOutputDir, fileName);
            const cmd = `az storage blob download --account-name "${STORAGE_ACCOUNT}" --container-name "${CONTAINER}" --name "${blob}" --file "${outputPath}" --auth-mode login --overwrite --no-progress -o none`;
            execSync(cmd, { stdio: "ignore" });
          } catch {
            console.error(`Error: failed to download blob ${blob}`);
            failed = 1;
          }
        }
      }
    }
  }

  if (failed !== 0) {
    console.error(
      `Completed with errors. Partial artifacts are in ${OUTPUT_ROOT}`
    );
    process.exit(1);
  }

  console.log(`Artifacts collected in ${OUTPUT_ROOT}`);
  process.exit(0);
}

run();
