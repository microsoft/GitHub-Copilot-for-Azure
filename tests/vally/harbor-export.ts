/*
cd tests && npx --no-install vally export --eval-spec ../evals/azure-skills/azure-aigateway/eval.yaml --exporter @microsoft/vally-exporter-harbor --grader-plugin ../../../tests/vally/vally-graders.ts --output-dir ../harbor/azure-aigateway
*/

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Export all vally stimuli from an eval yaml file to Harbor tasks and patch the task files with necessary changes.
 * The reported Harbor tasks will be written to <repo-root>/harbor/{skill-name}/{normalized-stimuli-name}/**
 * @param evalYamlPath Absolute path to the eval yaml file.
 *
 * Export an eval, build its task images, and configure Harbor to use them.
 * Requires built plugin output, Docker, and the installed Vally Harbor exporter.
 * Run from tests/: npx tsx vally/harbor-export.ts /absolute/path/to/eval.yaml
 */
export function harborExport(evalYamlPath: string): void {
  if (!path.isAbsolute(evalYamlPath)) {
    throw new Error("evalYamlPath must be an absolute path");
  }
  const evalPath = path.normalize(evalYamlPath);
  const skill = path.basename(path.dirname(evalPath));
  const plugin = path.basename(path.dirname(path.dirname(evalPath)));
  if (path.dirname(path.dirname(path.dirname(evalPath))) !== path.join(repoRoot, "evals")) {
    throw new Error("Expected an eval at <repo-root>/evals/<plugin>/<skill>/<file>.yaml");
  }
  if (!statSync(evalPath).isFile()) {
    throw new Error(`Eval is not a file: ${evalPath}`);
  }
  const skillsPath = path.join(repoRoot, "output", plugin, "skills");
  if (!statSync(skillsPath).isDirectory()) {
    throw new Error(`Built skills directory is missing: ${skillsPath}`);
  }

  const vallyEntry = path.join(
    path.dirname(require.resolve("@microsoft/vally-cli/package.json")),
    "dist",
    "index.js",
  );

  // Step 0: Delete existing task directories under harbor/{skill}/ before exporting new tasks.
  const outputDir = path.join(repoRoot, "harbor", skill);
  if (existsSync(outputDir)) {
    if (lstatSync(outputDir).isSymbolicLink()) {
      throw new Error(`Refusing to clean a symlinked output directory: ${outputDir}`);
    }
    for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        rmSync(path.join(outputDir, entry.name), { recursive: true });
      }
    }
  }

  // Step 1: Run vally export command to export the initial files
  // e.g. in tests/,
  // npx --no-install vally export --eval-spec {evalYamlPath} --exporter @microsoft/vally-exporter-harbor --output-dir ../harbor/{skill-name}
  // The {skill-name} is the name of the parent directory of the file at {evalYamlPath}.
  execFileSync(process.execPath, [
    vallyEntry, "export",
    "--eval-spec", evalPath,
    "--exporter", "@microsoft/vally-exporter-harbor",
    "--output-dir", outputDir,
  ], { cwd: path.join(repoRoot, "tests"), stdio: "inherit" });

  const tasks = readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  if (tasks.length === 0) {
    throw new Error(`No Harbor tasks were exported to ${outputDir}`);
  }
  for (const task of tasks) {
    const taskDir = path.join(outputDir, task.name);
    const environmentDir = path.join(taskDir, "environment");
    const dockerfilePath = path.join(environmentDir, "Dockerfile");
    const dockerfile = readFileSync(dockerfilePath, "utf8");
    if (!/^USER root\s*$/m.test(dockerfile)) {
      throw new Error(`Missing USER root in ${dockerfilePath}`);
    }

    // Exported fixture sources were relative to environment/, not the repo root.
    const contextPrefix = path.relative(repoRoot, environmentDir).split(path.sep).join("/");
    const rebased = dockerfile.replace(/^COPY (\[.*\])$/gm, (_line, json: string) => {
      const args: unknown = JSON.parse(json);
      if (!Array.isArray(args) || args.length < 2 || !args.every((arg): arg is string => typeof arg === "string")) {
        throw new Error(`Invalid COPY instruction in ${dockerfilePath}`);
      }
      const sources = args.slice(0, -1).map(source =>
        path.posix.join(contextPrefix, source));
      return `COPY ${JSON.stringify([...sources, args[args.length - 1]])}`;
    });
    // Step 3: Patch the Dockerfile generated at harbor/{skill-name}/{normalized-stimuli-name}/environment/Dockerfile to include these additional lines right after USER root
    // - ENV npm_config_registry=https://packagefeedproxy.microsoft.io/npm/
    // - RUN command apt-get update && apt-get install -y --no-install-recommends build-essential python3 libicu74
    // - COPY output/{plugin}/skills/ /skills/
    // {plugin} can be extracted from the end of evalYamlPath {plugin}/{skill}/eval.yaml
    const patched = rebased.replace(/^USER root\s*$/m, [
      "USER root",
      "ENV npm_config_registry=https://packagefeedproxy.microsoft.io/npm/",
      "RUN command apt-get update && apt-get install -y --no-install-recommends build-essential python3 libicu74",
      `COPY ${JSON.stringify([`output/${plugin}/skills/`, "/skills/"])}`,
    ].join("\n"));
    writeFileSync(dockerfilePath, patched);

    // Step 4: Build the image with a build context root at the repo root
    // The image name must end with the normalized name of the task
    const image = `harbor/${skill}:${task.name}`;
    execFileSync("docker", [
      "build", "--file", dockerfilePath, "--tag", image, repoRoot,
    ], { cwd: repoRoot, stdio: "inherit" });

    // Step 5: Configure the built image, skills directory, and Azure MCP server in task.toml.
    // [environment]
    // docker_image = "apple/unix-os:latest"
    // skills_dir = "/skills"
    const tomlPath = path.join(taskDir, "task.toml");
    const toml = readFileSync(tomlPath, "utf8");
    const environmentSection = /^\[environment\][^\S\n]*\r?\n([\s\S]*?)(?=^\[|(?![\s\S]))/m;
    if (!environmentSection.test(toml)) {
      throw new Error(`Missing [environment] section in ${tomlPath}`);
    }
    writeFileSync(tomlPath, toml.replace(environmentSection, (_section, body: string) => {
      const withoutOverrides = body.replace(/^[ \t]*(?:docker_image|skills_dir)[ \t]*=.*\r?\n?/gm, "");
      return `[environment]\ndocker_image = ${JSON.stringify(image)}\nskills_dir = "/skills"\n${withoutOverrides.trimEnd()}\n\n`
        + '[[environment.mcp_servers]]\nname = "azmcp"\ntransport = "stdio"\n'
        + 'command = "npx"\nargs = ["-y", "@azure/mcp@4.0.0-beta.6", "server", "start"]\n\n';
    }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evalPath = process.argv[2];
  if (!evalPath || process.argv.length !== 3) {
    console.error("Usage: npx tsx vally/harbor-export.ts <absolute-eval-yaml-path>");
    process.exitCode = 2;
  } else {
    try {
      harborExport(evalPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
