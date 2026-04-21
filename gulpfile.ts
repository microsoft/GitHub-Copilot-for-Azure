import { src, dest } from "gulp";
import { Transform } from "stream";
import * as nbgv from "nerdbank-gitversioning";
import * as path from "path";
import log from "fancy-log";
import { rmSync } from "fs";
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
        const skillName = file.relative.split("/")[1];
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
  return src("plugin/**/*", { dot: true, encoding: false })
    .pipe(stampSkillVersions())
    .pipe(stampPluginVersions())
    .pipe(dest("output"));
}

export default build;
