import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// For now, all newly scaffolded skills use only this shared schedule.
const DEFAULT_TEST_SCHEDULE = "0 12 * * 2-6";

interface SkillsConfig {
  plugins: Array<{
    dirname: string;
    skills: string[];
    integrationTestSchedule: Record<string, string>;
  }>;
}

export interface ScaffoldSkillOptions {
  plugin: string;
  skill: string;
  repoRoot: string;
}

function validateName(label: "plugin" | "skill", value: string): void {
  if (!NAME_PATTERN.test(value)) {
    throw new Error(`${label} must be lowercase letters, numbers, or hyphens`);
  }
}

function writeFileIfMissing(filePath: string, content: string, repoRoot: string): void {
  try {
    fs.writeFileSync(filePath, content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    console.warn(`File already exists, skipping: ${path.relative(repoRoot, filePath)}`);
  }
}

function appendCodeOwnerIfMissing(
  codeOwnersPath: string,
  sectionHeading: string,
  entryPath: string,
): void {
  const content = fs.readFileSync(codeOwnersPath, "utf8");
  const lines = content.split(/\r?\n/);
  const hasEntry = lines.some((line) => line.trimStart().startsWith(`${entryPath} `));
  if (hasEntry) {
    console.warn(`CODEOWNERS entry already exists, skipping: ${entryPath}`);
    return;
  }

  const sectionIndex = lines.indexOf(sectionHeading);
  if (sectionIndex === -1) {
    throw new Error(`CODEOWNERS section not found: ${sectionHeading}`);
  }

  const nextSectionOffset = lines
    .slice(sectionIndex + 1)
    .findIndex((line) => line.startsWith("# "));
  let insertionIndex = nextSectionOffset === -1
    ? lines.length
    : sectionIndex + 1 + nextSectionOffset;
  while (insertionIndex > sectionIndex + 1 && lines[insertionIndex - 1] === "") {
    insertionIndex--;
  }

  lines.splice(
    insertionIndex,
    0,
    `${entryPath} [required-codeowner-1] [required-codeowner-2] @RickWinter`,
  );
  fs.writeFileSync(codeOwnersPath, lines.join("\n"));
}

function addSkillToTestSchedule(repoRoot: string, plugin: string, skill: string): void {
  const skillsConfigPath = path.join(repoRoot, "tests", "skills.json");
  const skillsConfig = JSON.parse(fs.readFileSync(skillsConfigPath, "utf8")) as SkillsConfig;
  const pluginEntry = skillsConfig.plugins.find((entry) => entry.dirname === plugin);
  if (!pluginEntry) {
    throw new Error(`Plugin not found in tests/skills.json: ${plugin}`);
  }

  if (!pluginEntry.skills.includes(skill)) {
    pluginEntry.skills.push(skill);
  }

  const scheduledSkills = (pluginEntry.integrationTestSchedule[DEFAULT_TEST_SCHEDULE] ?? "")
    .split(",")
    .filter(Boolean);
  if (!scheduledSkills.includes(skill)) {
    scheduledSkills.push(skill);
    pluginEntry.integrationTestSchedule[DEFAULT_TEST_SCHEDULE] = scheduledSkills.join(",");
  }

  fs.writeFileSync(skillsConfigPath, `${JSON.stringify(skillsConfig, null, 4)}\n`);
}

export function scaffoldSkill({ plugin, skill, repoRoot }: ScaffoldSkillOptions): void {
  validateName("plugin", plugin);
  validateName("skill", skill);

  const skillsRoot = path.join(repoRoot, "plugins", plugin, "skills");
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Plugin does not exist or has no skills directory: plugins/${plugin}`);
  }

  const skillRoot = path.join(skillsRoot, skill);
  const evalRoot = path.join(repoRoot, "evals", plugin, skill);

  const skillMarkdown = `---
name: ${skill}
description: "<Describe what this skill does and when to use it. WHEN: '<trigger phrase>'>"
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

<Add instructions for the agent.>
`;
  const version = {
    version: "1.0",
    pathFilters: ["."],
  };
  const evalYaml = `name: ${skill}-eval
description: "Validates that ${skill} is invoked for a representative request."

tags:
  type: integration
  skill: ${skill}

defaults:
  runs: 1
  timeout: "10m"
  executor: integration-test-agent-runner

stimuli:
  - name: "Invoke ${skill}"
    turns:
      - "Invoke ${skill} skill and describe what it can do"
    tags:
      type: integration
      tier: smoke
      cost: llm
      area: routing
      requiredSkills:
        - ${skill}
    graders:
      - type: skill-invocation
        config:
          required:
            - ${skill}
`;

  fs.mkdirSync(skillRoot, { recursive: true });
  fs.mkdirSync(evalRoot, { recursive: true });
  writeFileIfMissing(path.join(skillRoot, "SKILL.md"), skillMarkdown, repoRoot);
  writeFileIfMissing(path.join(skillRoot, "version.json"), `${JSON.stringify(version, null, 2)}\n`, repoRoot);
  writeFileIfMissing(path.join(evalRoot, "eval.yaml"), evalYaml, repoRoot);

  const codeOwnersPath = path.join(repoRoot, ".github", "CODEOWNERS");
  appendCodeOwnerIfMissing(
    codeOwnersPath,
    "# Plugin skills owners (multi-plugin)",
    `/plugins/${plugin}/skills/${skill}/`,
  );
  appendCodeOwnerIfMissing(
    codeOwnersPath,
    "# Plugin skills evals owners (multi-plugin)",
    `/evals/${plugin}/${skill}/`,
  );
  addSkillToTestSchedule(repoRoot, plugin, skill);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      plugin: { type: "string" },
      skill: { type: "string" },
    },
    strict: true,
  });

  if (!values.plugin || !values.skill) {
    throw new Error("Usage: npm run skill:new -- --plugin <plugin-name> --skill <skill-name>");
  }

  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), "../../..");
  scaffoldSkill({ plugin: values.plugin, skill: values.skill, repoRoot });

  console.log(`Bootstrapped ${values.skill} in plugin ${values.plugin}`);
  console.log("Next: replace the required-codeowner placeholders in .github/CODEOWNERS");
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
