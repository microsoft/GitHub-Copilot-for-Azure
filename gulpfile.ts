import { src, dest } from "gulp";
import { Transform } from "stream";
import * as nbgv from "nerdbank-gitversioning";
import * as path from "path";
import log from "fancy-log";
import { execSync } from "child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import Vinyl = require("vinyl");

// Matches top-level skill files like skills/azure-deploy/SKILL.md but not nested ones.
const TOP_LEVEL_SKILL_RE = /^skills[\\/][^\\/]+[\\/]SKILL\.md$/;
// Matches plugin.json in the .plugin/, .cursor-plugin/, and .claude-plugin/ directories.
const PLUGIN_JSON_RE = /^\.(?:plugin|cursor-plugin|claude-plugin)[\\/]plugin\.json$/;

/**
 * By default the directory of the plugin in the build output should be the exact name of the plugin.
 * However, "azure" plugin has been published with "azure-skills" and external marketplaces that references our plugin may depend on it.
 * For example, https://github.com/github/awesome-copilot/blob/30472ecf0fe34cc561df958c08501ecc5ca80ea4/.github/plugin/marketplace.json#L142
 * If a plugin has a mapped directory name here, its build output will be written under the mapped directory name.
 */
const pluginDirnameMap = new Map<string, string>([
  ["azure", "azure-skills"]
]);

/**
 * Stamps each top-level skill's SKILL.md with a per-skill NBGV version.
 * Matches files like `skills/<name>/SKILL.md` (but not nested skills) and
 * calls `nbgv.getVersion()` against that skill's source directory, which
 * contains its own `version.json` with `pathFilters: ["."]`.
 */
function stampSkillVersions(plugin: string) {
  return new Transform({
    objectMode: true,
    async transform(file: Vinyl, _encoding, callback) {
      if (!TOP_LEVEL_SKILL_RE.test(file.relative)) {
        callback(null, file);
        return;
      }

      try {
        const skillName = file.relative.split(/[/\\]/)[1];
        const sourceSkillDir = path.resolve(`plugins/${plugin}/skills`, skillName);
        const versionInfo = await nbgv.getVersion(sourceSkillDir);
        const version = versionInfo.simpleVersion;

        const content = file.contents!.toString();
        const versionPlaceholderPattern =
          /(version:\s*")0\.0\.0-placeholder(")/;

        if (!versionPlaceholderPattern.test(content)) {
          throw new Error(
            `Failed to stamp skill version for ${file.relative}: expected to find version: "0.0.0-placeholder".`
          );
        }

        file.contents = Buffer.from(
          content.replace(versionPlaceholderPattern, `$1${version}$2`)
        );
        log(`setting skill version: plugins/${plugin}/skills/${skillName} ${version}`);
      } catch (err) {
        callback(err as Error);
        return;
      }

      callback(null, file);
    },
  });
}

/**
 * Stamps the plugin.json files in `.plugin/`, `.cursor-plugin/`, and
 * `.claude-plugin/` with a shared NBGV version derived from `plugin/version.json`.
 * The version is fetched once on the first matching file and cached for the rest.
 */
function stampPluginVersions(plugin: string) {
  let pluginVersionPromise: Promise<string> | null = null;

  return new Transform({
    objectMode: true,
    async transform(file: Vinyl, _encoding, callback) {
      if (!PLUGIN_JSON_RE.test(file.relative)) {
        callback(null, file);
        return;
      }

      try {
        if (!pluginVersionPromise) {
          pluginVersionPromise = nbgv
            .getVersion(path.resolve(`plugins/${plugin}`))
            .then((v) => v.simpleVersion);
        }
        const version = await pluginVersionPromise;

        const content = file.contents!.toString();
        const versionPlaceholderPattern =
          /("version":\s*")0\.0\.0-placeholder(")/;

        if (!versionPlaceholderPattern.test(content)) {
          throw new Error(
            `Failed to stamp plugin version for ${file.relative}: expected to find "version": "0.0.0-placeholder".`
          );
        }

        file.contents = Buffer.from(
          content.replace(versionPlaceholderPattern, `$1${version}$2`)
        );
        log(`setting plugin version: ${file.relative} ${version}`);
      } catch (err) {
        callback(err as Error);
        return;
      }

      callback(null, file);
    },
  });
}

function getPluginNames(): string[] {
  return readdirSync("plugins", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function buildPlugin(plugin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pluginSourceDir = path.join("plugins", plugin);
    const pluginDirnameOverride = pluginDirnameMap.get(plugin);
    const pluginOutputDir = path.join("output", pluginDirnameOverride ?? plugin);

    const pipeline = src(
      [
        `${pluginSourceDir}/**/*`,
        `!${pluginSourceDir}/**/version.json`,
        `!${pluginSourceDir}/CHANGELOG.md`,
        `!${pluginSourceDir}/changelog-*.md`, // legacy changelog
      ],
      { dot: true, encoding: false, base: pluginSourceDir }
    )
      .pipe(stampSkillVersions(plugin))
      .pipe(stampPluginVersions(plugin))
      .pipe(dest(pluginOutputDir));

    pipeline.on("error", (err) => reject(err));
    pipeline.on("end", () => {
      try {
        generateChangelog(plugin);
        resolve();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Failed to generate CHANGELOG.md for plugins/${plugin}.`, error);
        reject(error);
      }
    });
  });
}

async function build() {
  rmSync("output", { recursive: true, force: true });

  const plugins = getPluginNames();
  if (plugins.length === 0) {
    log.warn("No plugin directories found under plugins/; skipping build.");
    return;
  }

  for (const plugin of plugins) {
    await buildPlugin(plugin);
  }
}

/**
 * Generates a CHANGELOG.md in the output directory based on merged PRs
 * that touch plugin/ and have titles starting with fix:, feat:, feature:, chore:, misc:, test:, or eval:.
 * Each version corresponds to a single first-parent commit touching plugin/
 * since the NBGV baseline commit (when plugin/version.json was introduced).
 */
function generateChangelog(plugin: string): void {
  const pluginDir = path.join("plugins", plugin);

  // To preserve old changelog entries after moving plugin files,
  // we commit legacy changelog entries and compute a version offset so the
  // new generated version numbers keep increasing.
  const legacyChangelogFiles = readdirSync(pluginDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^changelog-.*\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  let firstLegacyVersionParts:
    | { major: number; minor: number; patch: number }
    | undefined;
  if (legacyChangelogFiles.length > 0) {
    const firstLegacyContent = readFileSync(
      path.join(pluginDir, legacyChangelogFiles[0]),
      "utf-8"
    );
    const firstVersionMatch = firstLegacyContent.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
    if (firstVersionMatch) {
      firstLegacyVersionParts = {
        major: Number(firstVersionMatch[1]),
        minor: Number(firstVersionMatch[2]),
        patch: Number(firstVersionMatch[3]),
      };
    }
  }

  const versionJson = JSON.parse(
    readFileSync(path.join(pluginDir, "version.json"), "utf-8")
  );
  const majorMinor = versionJson.version as string;
  const [major, minor] = majorMinor.split(".").map((s) => Number(s));

  let patchOffset = 0;
  if (firstLegacyVersionParts) {
    // When major/minor version is higher than the most recent major/minor in the legacy changelog,
    // the patch number must have been reset to 0 so we don't need an offset.
    if (major === firstLegacyVersionParts.major && minor === firstLegacyVersionParts.minor) {
      patchOffset = firstLegacyVersionParts.patch;
    }
  }

  // Find the commit that introduced plugins/<plugin>/version.json (the NBGV baseline).
  const versionJsonPath = `${pluginDir}/version.json`;
  const baselineCommit = execSync(
    `git log --diff-filter=A --format=%H --first-parent -- ${versionJsonPath}`,
    { encoding: "utf-8" }
  ).trim();

  if (!baselineCommit) {
    log.warn(`Could not find baseline commit for ${versionJsonPath}; skipping changelog generation.`);
    return;
  }

  // Enumerate first-parent commits touching plugins/<plugin>/ from baseline (inclusive) to HEAD.
  // We include the baseline itself by using baseline~1..HEAD (or just --ancestry-path from baseline).
  const logOutput = execSync(
    `git log --first-parent --format=%H%x00%s --reverse ${baselineCommit}~1..HEAD -- ${pluginDir}/`,
    { encoding: "utf-8" }
  ).trim();

  if (!logOutput) {
    log.warn(`No commits found touching ${pluginDir}/; skipping changelog generation.`);
    return;
  }

  const commits = logOutput.split("\n").map((line, index) => {
    const [hash, subject] = line.split("\0", 2);
    return { hash, subject, height: index + 1 };
  });

  // Filter to only include PRs with fix:/feat:/feature:/chore:/misc:/test:/eval: prefixes.
  const prefixRe = /^(fix|feat|feature|chore|misc|test|eval)(\(.+?\))?:/i;
  const filtered = commits.filter((c) => prefixRe.test(c.subject));

  // Determine the repository URL for PR links. Prefer the "upstream" remote
  // (the canonical repo where PRs live) and fall back to "origin".
  let remoteUrl: string;
  try {
    remoteUrl = execSync("git remote get-url upstream", { encoding: "utf-8" }).trim();
  } catch {
    remoteUrl = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
  }
  const repoUrl = remoteUrl.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");

  // Build changelog content (newest first).
  let content = "# Changelog\n";

  for (let i = filtered.length - 1; i >= 0; i--) {
    const entry = filtered[i];
    const version = `${majorMinor}.${entry.height + patchOffset}`;
    // Turn (#NNN) into a markdown link.
    const subject = entry.subject.replace(
      /\(#(\d+)\)/g,
      (_, num) => `([#${num}](${repoUrl}/pull/${num}))`
    );
    content += `\n## ${version}\n\n- ${subject}\n`;
  }

  // Add all the legacy changelog entries
  for (const legacyFile of legacyChangelogFiles) {
    const legacyContent = readFileSync(path.join(pluginDir, legacyFile), "utf-8");
    if (!legacyContent) {
      continue;
    }

    if (!content.endsWith("\n")) {
      content += "\n";
    }
    content += "\n";
    content += legacyContent;
    if (!legacyContent.endsWith("\n")) {
      content += "\n";
    }
  }

  const outputDir = path.join("output", plugin);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "CHANGELOG.md"), content, "utf-8");
  log(`generated CHANGELOG.md for plugins/${plugin} with ${filtered.length} entries`);
}

export default build;
