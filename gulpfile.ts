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
            .getVersion(path.resolve("plugin"))
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

/**
 * Generates a CHANGELOG.md in the output directory based on merged PRs
 * that touch plugin/ and have titles starting with fix:, feat:, or feature:.
 * Each version corresponds to a single first-parent commit touching plugin/
 * since the NBGV baseline commit (when plugin/version.json was introduced).
 */
function generateChangelog(): void {
  const versionJson = JSON.parse(
    readFileSync("plugin/version.json", "utf-8")
  );
  const majorMinor = versionJson.version as string;

  // Find the commit that introduced plugin/version.json (the NBGV baseline).
  const baselineCommit = execSync(
    "git log --diff-filter=A --format=%H --first-parent -- plugin/version.json",
    { encoding: "utf-8" }
  ).trim();

  if (!baselineCommit) {
    log.warn("Could not find baseline commit for plugin/version.json; skipping changelog generation.");
    return;
  }

  // Enumerate first-parent commits touching plugin/ from baseline (inclusive) to HEAD.
  // We include the baseline itself by using baseline~1..HEAD (or just --ancestry-path from baseline).
  const logOutput = execSync(
    `git log --first-parent --format=%H%x00%s --reverse ${baselineCommit}~1..HEAD -- plugin/`,
    { encoding: "utf-8" }
  ).trim();

  if (!logOutput) {
    log.warn("No commits found touching plugin/; skipping changelog generation.");
    return;
  }

  const commits = logOutput.split("\n").map((line, index) => {
    const [hash, subject] = line.split("\0", 2);
    return { hash, subject, height: index + 1 };
  });

  // Filter to only include PRs with fix:/feat:/feature: prefixes.
  const prefixRe = /^(fix|feat|feature)(\(.+?\))?:/i;
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
    const version = `${majorMinor}.${entry.height}`;
    // Turn (#NNN) into a markdown link.
    const subject = entry.subject.replace(
      /\(#(\d+)\)/g,
      (_, num) => `([#${num}](${repoUrl}/pull/${num}))`
    );
    content += `\n## ${version}\n\n- ${subject}\n`;
  }

  mkdirSync("output", { recursive: true });
  writeFileSync("output/CHANGELOG.md", content, "utf-8");
  log(`generated CHANGELOG.md with ${filtered.length} entries`);
}

export default build;
