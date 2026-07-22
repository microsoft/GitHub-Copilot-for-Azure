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
 * `.claude-plugin/` with using git commit height.
 */
function stampPluginVersions(plugin: string) {
  const versionJson = JSON.parse(
    readFileSync(`plugins/${plugin}/version.json`, "utf-8")
  );
  const majorMinor = versionJson.version as string;

  const commits = getVersionedCommits(plugin);

  // The last commit is the most recent commit
  const patchNumber = commits.length > 0
    ? commits[commits.length - 1].relativeHeight
    : 0;

  const version = `${majorMinor}.${patchNumber}`;

  return new Transform({
    objectMode: true,
    async transform(file: Vinyl, _encoding, callback) {
      if (!PLUGIN_JSON_RE.test(file.relative)) {
        callback(null, file);
        return;
      }

      try {
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

function getPluginDirnames(): string[] {
  return readdirSync("plugins", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function buildPlugin(pluginDirname: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pluginSourceDir = path.join("plugins", pluginDirname);
    const pluginOutputDir = path.join("output", pluginDirname);

    const pipeline = src(
      [
        `${pluginSourceDir}/**/*`,
        `!${pluginSourceDir}/**/version.json`,
        `!${pluginSourceDir}/CHANGELOG.md`,
        `!${pluginSourceDir}/changelog-*.md`, // legacy changelog
      ],
      { dot: true, encoding: false, base: pluginSourceDir }
    )
      .pipe(stampSkillVersions(pluginDirname))
      .pipe(stampPluginVersions(pluginDirname))
      .pipe(dest(pluginOutputDir));

    pipeline.on("error", (err) => reject(err));
    pipeline.on("end", () => {
      try {
        generateChangelog(pluginDirname);
        resolve();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Failed to generate CHANGELOG.md for plugins/${pluginDirname}.`, error);
        reject(error);
      }
    });
  });
}

async function build() {
  rmSync("output", { recursive: true, force: true });

  const plugins = getPluginDirnames();
  if (plugins.length === 0) {
    log.warn("No plugin directories found under plugins/; skipping build.");
    return;
  }

  for (const plugin of plugins) {
    await buildPlugin(plugin);
  }
}

type Commit = {
  hash: string;
  subject: string;
  height: number;

  /**
   * The major and minor version number that should be used when generating the version number from this commit.
   * The major and minor version number is the major and minor version number in the version.json file at the time the commit is created.
  */
  majorMinor: string;

  /**
   * The number of commits between this commit and the most recent one that touched the version.json file before.
   */
  relativeHeight: number;
};

/**
 * @returns Commits with their associated version numbers from oldest to newest.
 */
function getVersionedCommits(plugin: string): Commit[] {
  const pluginDir = `plugins/${plugin}`;

  // Find the commit that introduced plugin/version.json (the NBGV baseline).
  const baselineCommit = execSync(
    `git log --diff-filter=A --format=%H --first-parent -- ${pluginDir}/version.json`,
    { encoding: "utf-8" }
  ).trim();

  if (!baselineCommit) {
    log.warn(`Could not find baseline commit for ${pluginDir}/version.json; skipping changelog generation.`);
    return [];
  }

  // Enumerate all first-parent commits touching plugin/**/* from baseline (inclusive) to HEAD.
  const pluginLogOutput = execSync(
    `git log --first-parent --format=%H%x00%s --reverse ${baselineCommit}~1..HEAD -- ${pluginDir}/`,
    { encoding: "utf-8" }
  ).trim();

  if (!pluginLogOutput) {
    log.warn(`No commits found touching ${pluginDir}/; skipping changelog generation.`);
    return [];
  }

  // pluginFileCommits is ordered from oldest to newest
  const pluginFileCommits = pluginLogOutput.split("\n").map((line, index) => {
    const [hash, subject] = line.split("\0", 2);
    return { hash, subject, height: index + 1 };
  });

  // Enumerate all first-parent commits touching plugin/version.json.
  const versionLogOutput = execSync(
    `git log --first-parent --format=%H%x00%s --reverse ${baselineCommit}~1..HEAD -- ${pluginDir}/version.json`,
    { encoding: "utf-8" }
  ).trim();

  if (!versionLogOutput) {
    log.warn(`No commits found touching ${pluginDir}/version.json; skipping changelog generation.`);
    return [];
  }

  const pluginHeightByHash = new Map(pluginFileCommits.map((commit) => [commit.hash, commit.height]));

  // versionPoints is ordered from oldest to newest
  const versionPoints = versionLogOutput
    .split("\n")
    .map((line) => {
      const [hash] = line.split("\0", 1);
      const height = pluginHeightByHash.get(hash);

      if (height === undefined) {
        return null;
      }

      const versionJsonAtCommit = JSON.parse(
        execSync(`git show ${hash}:${pluginDir}/version.json`, { encoding: "utf-8" })
      ) as { version?: string };

      if (!versionJsonAtCommit.version) {
        throw new Error(`Missing version in ${pluginDir}/version.json at commit ${hash}`);
      }

      return {
        height,
        majorMinor: versionJsonAtCommit.version,
      };
    })
    .filter((point): point is { height: number; majorMinor: string } => point !== null);

  if (versionPoints.length === 0) {
    log.warn(`No usable version points found for ${pluginDir}/version.json; skipping changelog generation.`);
    return [];
  }

  // Reverse version points to order from newest to oldest
  const reversedVersionPoints = [...versionPoints.reverse()];

  return pluginFileCommits.map((commit) => {
    const nearestPrevious = reversedVersionPoints.find((point) => point.height <= commit.height) ?? versionPoints[0];
    const relativeHeight = nearestPrevious.height <= commit.height
      ? commit.height - nearestPrevious.height
      : 0;

    return {
      hash: commit.hash,
      subject: commit.subject,
      height: commit.height,
      majorMinor: nearestPrevious.majorMinor,
      relativeHeight,
    };
  });
}

function generateChangelog(plugin: string): void {
  const pluginDir = `plugins/${plugin}`;
  const versionedCommits = getVersionedCommits(plugin);

  if (versionedCommits.length === 0) {
    log.warn("No commit data available for changelog generation.");
    return;
  }

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

  // Moving files causes the git commit history to be lost and thus erases old changelog entries.
  // To preserve old changelog entries after moving plugin files,
  // we commit legacy changelog entries and compute a version offset so the
  // new generated version numbers keep increasing.
  // The file is named `changelog-<date-of-creation>.md` in `plugins/<plugin-dir>/`.
  // Update the file if we ever need to move files again.
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

  for (let i = versionedCommits.length - 1; i >= 0; i--) {
    const entry = versionedCommits[i];
    const version = `${entry.majorMinor}.${entry.relativeHeight + patchOffset}`;

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
  log(`generated CHANGELOG.md for plugins/${plugin} with ${versionedCommits.length} entries`);
}

export default build;
