import { src, dest } from "gulp";
import { Transform } from "stream";
import * as nbgv from "nerdbank-gitversioning";
import * as path from "path";
import log from "fancy-log";
import { execSync } from "child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
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
function stampSkillVersions() {
  return new Transform({
    objectMode: true,
    async transform(file: Vinyl, _encoding, callback) {
      if (!TOP_LEVEL_SKILL_RE.test(file.relative)) {
        callback(null, file);
        return;
      }

      try {
        const skillName = file.relative.split(/[/\\]/)[1];
        const sourceSkillDir = path.resolve("plugin/skills", skillName);
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
        log(`setting skill version: skills/${skillName} ${version}`);
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
function stampPluginVersions() {
  const versionJson = JSON.parse(
    readFileSync("plugin/version.json", "utf-8")
  );
  const majorMinor = versionJson.version as string;

  const commits = getVersionedCommits();

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

function build() {
  rmSync("output", { recursive: true, force: true });
  const pipeline = src(["plugin/**/*", "!plugin/**/version.json", "!plugin/CHANGELOG.md"], { dot: true, encoding: false })
    .pipe(stampSkillVersions())
    .pipe(stampPluginVersions())
    .pipe(dest("output"));

  pipeline.on("end", () => {
    try {
      generateChangelog();
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      log.error("Failed to generate CHANGELOG.md after writing output/.", error);
      throw error;
    }
  });

  return pipeline;
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
function getVersionedCommits(): Commit[] {
  const pluginDir = "plugin";

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

/**
 * Generates a CHANGELOG.md in the output directory based on merged PRs
 * that touch plugin/ and have titles starting with fix:, feat:, feature:, chore:, misc:, test:, or eval:.
 * Each version corresponds to a single first-parent commit touching plugin/
 * since the NBGV baseline commit (when plugin/version.json was introduced).
 */
function generateChangelog(): void {
  const versionedCommits = getVersionedCommits();

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

  for (let i = versionedCommits.length - 1; i >= 0; i--) {
    const entry = versionedCommits[i];
    const version = `${entry.majorMinor}.${entry.relativeHeight}`;

    // Turn (#NNN) into a markdown link.
    const subject = entry.subject.replace(
      /\(#(\d+)\)/g,
      (_, num) => `([#${num}](${repoUrl}/pull/${num}))`
    );
    content += `\n## ${version}\n\n- ${subject}\n`;
  }

  mkdirSync("output", { recursive: true });
  writeFileSync("output/CHANGELOG.md", content, "utf-8");
  log(`generated CHANGELOG.md with ${versionedCommits.length} entries`);
}

export default build;
