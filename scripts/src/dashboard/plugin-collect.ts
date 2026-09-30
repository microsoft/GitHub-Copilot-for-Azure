import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url))
const GHCP_PLUGIN_DIRNAME = "ghcp";

function listDirectories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function collectPluginSkills() {
  const repoRoot = resolve(__dirname, "../../..");
  const pluginsDir = resolve(repoRoot, "plugins");

  const plugins: Record<string, string[]> = {};

  for (const pluginName of listDirectories(pluginsDir)) {
    const skillsDir = resolve(pluginsDir, pluginName, "skills");
    try {
      plugins[pluginName] = listDirectories(skillsDir);
    } catch {
      plugins[pluginName] = [];
    }
  }

  // Collect skills in .github/skills as if they are in a plugin named "ghcp"
  const githubSkillsDir = resolve(repoRoot, ".github", "skills");
  const skills = listDirectories(githubSkillsDir)
  plugins[GHCP_PLUGIN_DIRNAME] = skills;

  const output = { plugins };
  const outputPath = resolve(repoRoot, "dashboard", "data", "plugin-skills.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
}