import * as fs from "node:fs";
import * as path from "node:path";

const EXCLUDED_FILENAMES = new Set([
  "SKILL.md",
  "version.json",
  "LICENSE",
  "LICENSE.txt",
  "LICENSE.md",
]);

export type PluginAllowlists = {
  skills: string[];
  references: string[];
};

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

export function collectPluginAllowlists(skillsDir: string): PluginAllowlists {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { skills: [], references: [] };
    }
    throw error;
  }

  const skills = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  const references: string[] = [];

  for (const skill of skills) {
    for (const filePath of walkDir(path.join(skillsDir, skill))) {
      if (!EXCLUDED_FILENAMES.has(path.basename(filePath))) {
        references.push(path.relative(skillsDir, filePath).replace(/\//g, "\\"));
      }
    }
  }

  return { skills, references: references.sort() };
}

export function writePluginAllowlists(pluginDir: string): void {
  fs.accessSync(pluginDir);
  const { skills, references } = collectPluginAllowlists(path.join(pluginDir, "skills"));
  const outputDir = path.join(pluginDir, "hooks", "allowlists");
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [filename, entries] of [
    ["allowed-skills.txt", skills],
    ["allowed-references.txt", references],
  ] as const) {
    fs.writeFileSync(
      path.join(outputDir, filename),
      entries.length > 0 ? `${entries.join("\n")}\n` : "",
      "utf8",
    );
  }
}
