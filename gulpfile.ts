import { src, dest } from "gulp";
import { Transform } from "stream";
import * as nbgv from "nerdbank-gitversioning";
import * as path from "path";
import log from "fancy-log";
import { execSync } from "child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { isDeepStrictEqual } from "util";
import Vinyl = require("vinyl");

// Matches top-level skill files like skills/azure-deploy/SKILL.md but not nested ones.
const TOP_LEVEL_SKILL_RE = /^skills[\\/][^\\/]+[\\/]SKILL\.md$/;
// Matches plugin.json in the .plugin/, .cursor-plugin/, and .claude-plugin/ directories.
const PLUGIN_JSON_RE = /^\.(?:plugin|cursor-plugin|claude-plugin)[\\/]plugin\.json$/;
const HOOK_MANIFESTS = [
  "claude-hooks.json",
  "copilot-hooks.json",
  "cursor-hooks.json",
] as const;
const REQUIRED_PLUGIN_HOOK_FILES = [
  "scripts/pluginPathAllowPattern.ps1",
  "scripts/pluginPathAllowPattern.sh",
] as const;
const PLUGIN_METADATA_CLIENTS = [
  { clientName: "copilot", manifestDirectory: ".plugin" },
  { clientName: "cursor", manifestDirectory: ".cursor-plugin" },
  { clientName: "claude-code", manifestDirectory: ".claude-plugin" },
] as const;

type HookManifest = {
  hooks: Record<string, unknown[]>;
  [key: string]: unknown;
};

type HookAssemblyOptions = {
  repositoryRoot?: string;
  outputRoot?: string;
};

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
function stampPluginVersions(plugin: string, legacyChangelog?: LegacyChangelog) {
  const versionJson = JSON.parse(
    readFileSync(`plugins/${plugin}/version.json`, "utf-8")
  );
  const majorMinor = versionJson.version as string;

  const commits = getVersionedCommits(plugin);

  // The last commit is the most recent commit
  let patchNumber = commits.length > 0
    ? commits[commits.length - 1].relativeHeight
    : 0;
  if (legacyChangelog) {
    patchNumber += legacyChangelog.patchOffset;
  }

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

function getPluginVersionedPaths(plugin: string): string[] {
  return [`plugins/${plugin}`, "hooks"];
}

function collectHookFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  if (!existsSync(root)) {
    return files;
  }

  const resolvedRoot = path.resolve(root);

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const sourcePath = path.join(directory, entry.name);
      const relativePath = path.relative(resolvedRoot, sourcePath);

      if (
        relativePath.startsWith(`..${path.sep}`) ||
        relativePath === ".." ||
        path.isAbsolute(relativePath)
      ) {
        throw new Error(`Hook source path is outside its root: ${sourcePath}`);
      }
      if (entry.isSymbolicLink() || lstatSync(sourcePath).isSymbolicLink()) {
        throw new Error(`Hook source symlinks are not supported: ${sourcePath}`);
      }
      if (entry.isDirectory()) {
        visit(sourcePath);
      } else if (entry.isFile()) {
        files.set(relativePath.split(path.sep).join("/"), sourcePath);
      }
    }
  }

  visit(resolvedRoot);
  return files;
}

function parseHookManifest(filePath: string, sourceDescription: string): HookManifest {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${sourceDescription}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${sourceDescription} must contain a JSON object.`);
  }

  const manifest = value as Record<string, unknown>;
  const hooks = manifest.hooks;
  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) {
    throw new Error(`${sourceDescription} must contain a "hooks" object.`);
  }

  for (const [eventName, registrations] of Object.entries(hooks)) {
    if (!Array.isArray(registrations)) {
      throw new Error(
        `${sourceDescription} hook event "${eventName}" must contain an array.`
      );
    }
  }

  return manifest as HookManifest;
}

function mergeHookManifests(
  shared: HookManifest,
  fragment: HookManifest,
  fragmentDescription: string,
): HookManifest {
  for (const [key, value] of Object.entries(fragment)) {
    if (key === "hooks") {
      continue;
    }
    if (!(key in shared)) {
      throw new Error(
        `${fragmentDescription} contains unsupported top-level field "${key}".`
      );
    }
    if (!isDeepStrictEqual(value, shared[key])) {
      throw new Error(
        `${fragmentDescription} conflicts with shared top-level field "${key}".`
      );
    }
  }

  const hooks: Record<string, unknown[]> = {};
  for (const [eventName, registrations] of Object.entries(shared.hooks)) {
    hooks[eventName] = [...registrations];
  }
  for (const [eventName, registrations] of Object.entries(fragment.hooks)) {
    hooks[eventName] = hooks[eventName]
      ? [...hooks[eventName], ...registrations]
      : [...registrations];
  }

  return { ...shared, hooks };
}

function copyHookFile(sourcePath: string, destinationPath: string): void {
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
  chmodSync(destinationPath, statSync(sourcePath).mode);
}

function readJsonObject(filePath: string, description: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${description}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${description} must contain a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function requireMetadataString(
  value: unknown,
  fieldName: string,
  description: string
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(
      `${description} field "${fieldName}" must contain a non-empty string without control characters.`
    );
  }
  return value;
}

function writePluginHookMetadata(
  pluginDirname: string,
  outputRoot: string,
  destinationRoot: string
): void {
  const pluginOutputRoot = path.join(outputRoot, pluginDirname);
  let pluginName: string | undefined;
  let pluginVersion: string | undefined;

  for (const client of PLUGIN_METADATA_CLIENTS) {
    const manifestPath = path.join(
      pluginOutputRoot,
      client.manifestDirectory,
      "plugin.json"
    );
    if (!existsSync(manifestPath)) {
      throw new Error(
        `Missing built plugin manifest output/${pluginDirname}/${client.manifestDirectory}/plugin.json.`
      );
    }

    const description =
      `built plugin manifest output/${pluginDirname}/${client.manifestDirectory}/plugin.json`;
    const manifest = readJsonObject(manifestPath, description);
    const clientPluginName = requireMetadataString(manifest.name, "name", description);
    const clientPluginVersion = requireMetadataString(
      manifest.version,
      "version",
      description
    );

    pluginName ??= clientPluginName;
    pluginVersion ??= clientPluginVersion;
    if (clientPluginName !== pluginName || clientPluginVersion !== pluginVersion) {
      throw new Error(
        `Built plugin manifests for ${pluginDirname} must use the same name and version; ` +
        `${client.clientName} has "${clientPluginName}" version "${clientPluginVersion}", ` +
        `expected "${pluginName}" version "${pluginVersion}".`
      );
    }
  }

  if (!pluginName || !pluginVersion) {
    throw new Error(`No built plugin manifests were found for ${pluginDirname}.`);
  }

  const mcpConfigPath = path.join(pluginOutputRoot, ".mcp.json");
  let mcpServerNames: string[] = [];

  if (existsSync(mcpConfigPath)) {
    const description = `built MCP configuration output/${pluginDirname}/.mcp.json`;
    const config = readJsonObject(mcpConfigPath, description);
    if (
      typeof config.mcpServers !== "object" ||
      config.mcpServers === null ||
      Array.isArray(config.mcpServers)
    ) {
      throw new Error(`${description} field "mcpServers" must contain a JSON object.`);
    }

    mcpServerNames = Object.keys(config.mcpServers).sort();
    for (const serverName of mcpServerNames) {
      requireMetadataString(serverName, "mcpServers key", description);
    }
  }

  const metadataLines = [
    `plugin-name=${pluginName}`,
    `plugin-version=${pluginVersion}`,
    ...mcpServerNames.map(serverName => `mcp-server=${serverName}`),
  ];
  writeFileSync(
    path.join(destinationRoot, "metadata.txt"),
    `${metadataLines.join("\n")}\n`
  );
}

export function assemblePluginHooks(
  pluginDirname: string,
  options: HookAssemblyOptions = {},
): void {
  const repositoryRoot = options.repositoryRoot ?? __dirname;
  const outputRoot = options.outputRoot ?? path.join(repositoryRoot, "output");
  const sharedRoot = path.join(repositoryRoot, "hooks");
  const pluginRoot = path.join(repositoryRoot, "plugins", pluginDirname, "hooks");
  const destinationRoot = path.join(outputRoot, pluginDirname, "hooks");
  const sharedFiles = collectHookFiles(sharedRoot);
  const pluginFiles = collectHookFiles(pluginRoot);

  for (const requiredFile of REQUIRED_PLUGIN_HOOK_FILES) {
    if (!pluginFiles.has(requiredFile)) {
      throw new Error(
        `Plugin ${pluginDirname} is missing required hook file plugins/${pluginDirname}/hooks/${requiredFile}.`
      );
    }
  }

  const sharedCopyFiles = new Map(
    [...sharedFiles].filter(
      ([relativePath]) =>
        !HOOK_MANIFESTS.includes(relativePath as typeof HOOK_MANIFESTS[number]) &&
        !relativePath.toLowerCase().endsWith(".md")
    )
  );
  const pluginCopyFiles = new Map(
    [...pluginFiles].filter(
      ([relativePath]) =>
        !HOOK_MANIFESTS.includes(relativePath as typeof HOOK_MANIFESTS[number])
    )
  );

  for (const relativePath of pluginCopyFiles.keys()) {
    if (sharedCopyFiles.has(relativePath)) {
      throw new Error(
        `Hook path collision for plugin ${pluginDirname}: ${relativePath} exists in both shared and plugin hook sources.`
      );
    }
  }

  rmSync(destinationRoot, { recursive: true, force: true });
  mkdirSync(destinationRoot, { recursive: true });

  for (const [relativePath, sourcePath] of sharedCopyFiles) {
    copyHookFile(sourcePath, path.join(destinationRoot, relativePath));
  }
  for (const [relativePath, sourcePath] of pluginCopyFiles) {
    copyHookFile(sourcePath, path.join(destinationRoot, relativePath));
  }

  for (const manifestName of HOOK_MANIFESTS) {
    const sharedPath = sharedFiles.get(manifestName);
    if (!sharedPath) {
      throw new Error(`Missing shared hook manifest hooks/${manifestName}.`);
    }

    const sharedManifest = parseHookManifest(
      sharedPath,
      `shared hook manifest hooks/${manifestName}`,
    );
    const fragmentPath = pluginFiles.get(manifestName);
    const compiledManifest = fragmentPath
      ? mergeHookManifests(
          sharedManifest,
          parseHookManifest(
            fragmentPath,
            `plugin hook fragment plugins/${pluginDirname}/hooks/${manifestName}`,
          ),
          `Plugin hook fragment plugins/${pluginDirname}/hooks/${manifestName}`,
        )
      : sharedManifest;

    writeFileSync(
      path.join(destinationRoot, manifestName),
      `${JSON.stringify(compiledManifest, null, 2)}\n`,
    );
  }

  writePluginHookMetadata(pluginDirname, outputRoot, destinationRoot);
}

function buildPlugin(pluginDirname: string): Promise<void> {
  const legacyChangelog = getLegacyChangelog(pluginDirname);

  return new Promise((resolve, reject) => {
    const pluginSourceDir = path.join("plugins", pluginDirname);
    const pluginOutputDir = path.join("output", pluginDirname);

    const pipeline = src(
      [
        `${pluginSourceDir}/**/*`,
        `!${pluginSourceDir}/**/version.json`,
        `!${pluginSourceDir}/CHANGELOG.md`,
        `!${pluginSourceDir}/changelog-*.md`, // legacy changelog
        `!${pluginSourceDir}/hooks/**/*`,
      ],
      { dot: true, encoding: false, base: pluginSourceDir }
    )
      .pipe(stampSkillVersions(pluginDirname))
      .pipe(stampPluginVersions(pluginDirname, legacyChangelog))
      .pipe(dest(pluginOutputDir));

    pipeline.on("error", (err) => reject(err));
    pipeline.on("end", () => {
      try {
        assemblePluginHooks(pluginDirname);
        generateChangelog(pluginDirname, legacyChangelog);
        resolve();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Failed to build plugins/${pluginDirname}.`, error);
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
   * The number of versioned commits since the most recent major/minor version change.
   */
  relativeHeight: number;
};

/**
 * @returns Commits with their associated version numbers from oldest to newest.
 */
export function getVersionedCommits(plugin: string): Commit[] {
  const pluginDir = `plugins/${plugin}`;
  const versionedPaths = getPluginVersionedPaths(plugin)
    .map((versionedPath) => `"${versionedPath}"`)
    .join(" ");

  // Find the commit that introduced plugin/version.json (the NBGV baseline).
  const baselineCommit = execSync(
    `git log --diff-filter=A --format=%H --first-parent -- ${pluginDir}/version.json`,
    { encoding: "utf-8" }
  ).trim();

  if (!baselineCommit) {
    log.warn(`Could not find baseline commit for ${pluginDir}/version.json; skipping changelog generation.`);
    return [];
  }

  // Enumerate all first-parent commits affecting the built plugin from baseline
  // (inclusive) to HEAD. Shared hooks are copied into every plugin.
  const pluginLogOutput = execSync(
    `git log --first-parent --format=%H%x00%s --reverse ${baselineCommit}~1..HEAD -- ${versionedPaths}`,
    { encoding: "utf-8" }
  ).trim();

  if (!pluginLogOutput) {
    log.warn(`No commits found affecting ${pluginDir}; skipping changelog generation.`);
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

  // versionPoints is ordered from oldest to newest. Only an actual major/minor
  // change resets the relative height; edits to other version.json settings do not.
  let previousMajorMinor: string | undefined;
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

      if (versionJsonAtCommit.version === previousMajorMinor) {
        return null;
      }
      previousMajorMinor = versionJsonAtCommit.version;

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

function generateChangelog(plugin: string, legacyChangelog?: LegacyChangelog): void {
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

  let patchOffset = 0;
  if (legacyChangelog) {
    patchOffset = legacyChangelog.patchOffset;
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
  if (legacyChangelog) {
    if (!content.endsWith("\n")) {
      content += "\n";
    }
    content += "\n";
    content += legacyChangelog.legacyChangelogContent;
    if (!legacyChangelog.legacyChangelogContent.endsWith("\n")) {
      content += "\n";
    }
  }

  const outputDir = path.join("output", plugin);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "CHANGELOG.md"), content, "utf-8");
  log(`generated CHANGELOG.md for plugins/${plugin} with ${versionedCommits.length} entries`);
}

type LegacyChangelog = {
  patchOffset: number;
  legacyChangelogContent: string;
};

function getLegacyChangelog(plugin: string): LegacyChangelog | undefined {
  const pluginDir = `plugins/${plugin}`;
  // Moving files causes the git commit history to be lost and thus erases old changelog entries.
  // To preserve old changelog entries after moving plugin files,
  // we commit legacy changelog entries and compute a version offset so the
  // new generated version numbers keep increasing.
  // The file is named `changelog-<date-of-creation>.md` in `plugins/<plugin-dir>/`.
  // Update the file if we ever need to move files again.
  const legacyChangelogFile = readdirSync(pluginDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^changelog-.*\.md$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
    .at(0);

  if (!legacyChangelogFile) {
    return undefined;
  }

  let firstLegacyVersionParts:
    | { major: number; minor: number; patch: number }
    | undefined;

  const firstLegacyContent = readFileSync(
    path.join(pluginDir, legacyChangelogFile),
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
      patchOffset = firstLegacyVersionParts.patch + 1;
    }
  }

  const content = readFileSync(path.join(pluginDir, legacyChangelogFile), "utf-8");

  return {
    patchOffset,
    legacyChangelogContent: content
  };
}

export default build;
