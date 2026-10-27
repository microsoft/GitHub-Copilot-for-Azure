/**
 * Discover Azure permission groups from stimulus tags in nested eval YAML files.
 * Invalid YAML and malformed stimuli are logged and skipped; missing
 * azurePermission tags represent the default identity ("").
 *
 * Used by the setup job in .github/workflows/test-all-integration.yml.
 * With comma-separated SKILLS_INPUT, writes read-matrix, none-matrix,
 * default-matrix, and report-matrix JSON outputs to GITHUB_OUTPUT. These drive
 * the permission-specific test jobs and per-skill report aggregation.
 * Invalid skill references or unsupported permissions fail matrix generation;
 * azure-skills/azure-deploy is excluded because it has a separate workflow.
 *
 * Also supports PLUGIN_DIR and SKILL_NAME to emit a single skill's unique
 * permissions array. Both modes require GITHUB_WORKSPACE and GITHUB_OUTPUT.
 * Run from tests/: npx tsx discover-azure-permissions.ts
 */
import { appendFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

type Stimulus = Record<string, unknown> & { tags?: { azurePermission?: string } };
type EvalSuite = Record<string, unknown> & { stimuli: Stimulus[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStimulus(value: unknown): value is Stimulus {
  return isObject(value) && (
    value.tags === undefined || (
      isObject(value.tags) && (
        value.tags.azurePermission === undefined
        || typeof value.tags.azurePermission === "string"
      )
    )
  );
}

export function readEvalSuites(evalDir: string): { file: string; suite: EvalSuite }[] {
  const suites: { file: string; suite: EvalSuite }[] = [];
  const files = readdirSync(evalDir, { recursive: true, encoding: "utf8" }).sort();

  for (const file of files) {
    const evalFile = path.join(evalDir, file);
    if (!file.endsWith(".yaml") || !statSync(evalFile).isFile()) {
      continue;
    }

    const document = parseDocument(readFileSync(evalFile, "utf8"));
    if (document.errors.length > 0) {
      console.warn(`Skipping invalid YAML ${evalFile}: ${document.errors.map(error => error.message).join("; ")}`);
      continue;
    }

    const suite: unknown = document.toJS();
    const stimuli: unknown = isObject(suite) ? suite.stimuli : undefined;
    if (!isObject(suite) || !Array.isArray(stimuli) || !stimuli.every(isStimulus)) {
      console.warn(`Skipping ${evalFile}: expected stimuli objects with optional string azurePermission tags`);
      continue;
    }

    suites.push({ file: evalFile, suite: { ...suite, stimuli } });
  }

  return suites;
}

export function discoverAzurePermissions(evalDir: string): string[] {
  return [...new Set(readEvalSuites(evalDir).flatMap(({ suite }) =>
    suite.stimuli.map(stimulus => stimulus.tags?.azurePermission ?? "")
  ))];
}

export function buildPermissionMatrices(workspace: string, skills: string[]) {
  const matrices = {
    read: [] as string[],
    none: [] as string[],
    default: [] as string[],
    report: [] as { skill: string; permissions: string[] }[],
  };
  for (const skill of new Set(skills)) {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(skill)) {
      throw new Error(`Invalid plugin/skill reference: ${skill}`);
    }
    if (skill === "azure-skills/azure-deploy") {
      continue;
    }
    const permissions = discoverAzurePermissions(path.join(workspace, "evals", skill));
    for (const permission of permissions) {
      if (permission !== "" && permission !== "read" && permission !== "none") {
        throw new Error(`Unsupported Azure permission "${permission}" in ${skill}`);
      }
      matrices[permission === "" ? "default" : permission].push(skill);
    }
    if (permissions.length > 0) {
      matrices.report.push({ skill, permissions });
    }
  }
  return matrices;
}

function main(): void {
  const { GITHUB_WORKSPACE, PLUGIN_DIR, SKILL_NAME, GITHUB_OUTPUT } = process.env;
  if (GITHUB_WORKSPACE && GITHUB_OUTPUT && process.env.SKILLS_INPUT !== undefined) {
    const matrices = buildPermissionMatrices(
      GITHUB_WORKSPACE,
      process.env.SKILLS_INPUT.split(",").map(skill => skill.trim()).filter(Boolean),
    );
    for (const [group, matrix] of Object.entries(matrices)) {
      appendFileSync(GITHUB_OUTPUT, `${group}-matrix=${JSON.stringify(matrix)}\n`, "utf8");
    }
    return;
  }
  if (!GITHUB_WORKSPACE || !PLUGIN_DIR || !SKILL_NAME || !GITHUB_OUTPUT) {
    throw new Error("GITHUB_WORKSPACE, PLUGIN_DIR, SKILL_NAME, and GITHUB_OUTPUT are required");
  }
  const permissions = discoverAzurePermissions(path.join(GITHUB_WORKSPACE, "evals", PLUGIN_DIR, SKILL_NAME));
  const result = JSON.stringify(permissions);
  console.log(`Required Azure permissions: ${result}`);
  appendFileSync(GITHUB_OUTPUT, `permissions=${result}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
