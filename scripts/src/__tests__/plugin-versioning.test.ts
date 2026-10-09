import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const gulpfile = path.join(repoRoot, "gulpfile.ts");
const tsNodeRegister = path.join(
  repoRoot,
  "node_modules",
  "ts-node",
  "register"
);

let tempDir: string | undefined;

function runGit(...args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: tempDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

function commit(message: string): void {
  runGit("add", "--all");
  runGit("commit", "--quiet", "-m", message);
}

function getVersionedCommits(): Array<{
  subject: string;
  majorMinor: string;
  relativeHeight: number;
}> {
  const script = `
    const { getVersionedCommits } = require(${JSON.stringify(gulpfile)});
    process.stdout.write(JSON.stringify(getVersionedCommits("test-plugin")));
  `;
  const result = spawnSync(
    process.execPath,
    ["-r", tsNodeRegister, "-e", script],
    {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        TS_NODE_PROJECT: path.join(repoRoot, "tsconfig.json"),
      },
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }

  return JSON.parse(result.stdout);
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("plugin version history", () => {
  it("counts shared hooks, ignores path-filter resets, and resets for version changes", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "plugin-versioning-"));
    runGit("init", "--quiet", "--initial-branch=main");
    runGit("config", "user.name", "Version Test");
    runGit("config", "user.email", "version-test@example.com");

    writeFileSync(path.join(tempDir, "README.md"), "test repository\n");
    commit("initial commit");

    const pluginDir = path.join(tempDir, "plugins", "test-plugin");
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      path.join(pluginDir, "version.json"),
      JSON.stringify({ version: "1.0", pathFilters: ["."] })
    );
    commit("add plugin version baseline");

    writeFileSync(path.join(pluginDir, "plugin.txt"), "plugin content\n");
    commit("change plugin content");

    writeFileSync(
      path.join(pluginDir, "version.json"),
      JSON.stringify({ version: "1.0", pathFilters: [".", ":/hooks"] })
    );
    commit("track shared hooks");

    const hooksDir = path.join(tempDir, "hooks");
    mkdirSync(hooksDir);
    writeFileSync(path.join(hooksDir, "hook.txt"), "hook content\n");
    commit("change shared hook");

    writeFileSync(
      path.join(pluginDir, "version.json"),
      JSON.stringify({ version: "2.0", pathFilters: [".", ":/hooks"] })
    );
    commit("bump plugin version");

    const commits = getVersionedCommits();

    expect(
      commits.map(({ subject, majorMinor, relativeHeight }) => ({
        subject,
        majorMinor,
        relativeHeight,
      }))
    ).toEqual([
      {
        subject: "add plugin version baseline",
        majorMinor: "1.0",
        relativeHeight: 0,
      },
      {
        subject: "change plugin content",
        majorMinor: "1.0",
        relativeHeight: 1,
      },
      {
        subject: "track shared hooks",
        majorMinor: "1.0",
        relativeHeight: 2,
      },
      {
        subject: "change shared hook",
        majorMinor: "1.0",
        relativeHeight: 3,
      },
      {
        subject: "bump plugin version",
        majorMinor: "2.0",
        relativeHeight: 0,
      },
    ]);
  });
});
