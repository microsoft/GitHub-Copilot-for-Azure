import { readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname, parse as parsePath } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Walk up from `startDir` looking for a `.git` directory — the first match
 * is the repo root.
 */
function findRepoRoot(startDir: string): string {
  let dir = resolve(startDir);
  const { root } = parsePath(dir);

  while (dir !== root) {
    try {
      const gitStat = statSync(resolve(dir, ".git"));
      if (gitStat.isDirectory() || gitStat.isFile()) return dir;
    } catch {
      // keep walking
    }
    dir = dirname(dir);
  }

  return startDir;
}

function listDirectories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function collectPluginSkills() {
  const scriptDir = __dirname;
  const repoRoot = findRepoRoot(scriptDir);
  const pluginsDir = resolve(repoRoot, "plugins");

  const plugins: Record<string, string[]> = {};

  for (const pluginName of listDirectories(pluginsDir)) {
    const skillsDir = resolve(pluginsDir, pluginName, "skills");
    let skills: string[] = [];
    try {
      skills = listDirectories(skillsDir);
    } catch {
      skills = [];
    }
    plugins[pluginName] = skills;
  }

  const output = { plugins };
  const outputPath = resolve(repoRoot, "dashboard", "data", "plugin-skills.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
}