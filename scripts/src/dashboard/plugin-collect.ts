import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url))

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

  const output = { plugins };
  const outputPath = resolve(repoRoot, "dashboard", "data", "plugin-skills.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
}