import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const load = createRequire(import.meta.url);
const { register }: typeof import("ts-node") = load(join(REPO_ROOT, "node_modules", "ts-node"));
register({ project: join(REPO_ROOT, "tsconfig.json"), compilerOptions: { types: ["node"] } });
const { collectPluginAllowlists, writePluginAllowlists }: typeof import("../plugin-allowlists.cjs") =
  load("../plugin-allowlists.cts");
let root: string;

function write(relativePath: string, content = "fixture\n"): void {
  const file = join(root, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function read(plugin: string, filename: string): string {
  return readFileSync(join(root, plugin, filename), "utf8");
}

function readAllowlist(plugin: string, filename: string): string {
  return read(plugin, join("hooks", "allowlists", filename));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "plugin allowlists-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("plugin text allowlists", () => {
  it("writes sorted plugin-specific names and supporting files with the existing exclusions", () => {
    write("alpha/skills/z-skill/SKILL.md");
    write("alpha/skills/z-skill/references/z.md");
    write("alpha/skills/a-skill/SKILL.md");
    write("alpha/skills/a-skill/references/nested/a.md");
    write("alpha/skills/a-skill/scripts/helper.ps1");
    write("alpha/skills/a-skill/assets/sample.json");
    write("alpha/skills/.hidden/SKILL.md");
    write("alpha/skills/.hidden/private.md");
    write("alpha/skills/not-a-skill.txt");
    write("alpha/README.md");
    write("beta/skills/other-skill/SKILL.md");
    write("beta/skills/other-skill/references/other.md");
    for (const excluded of ["SKILL.md", "version.json", "LICENSE", "LICENSE.txt", "LICENSE.md"]) {
      write(`alpha/skills/a-skill/${excluded}`);
      write(`alpha/skills/a-skill/references/${excluded}`);
    }

    writePluginAllowlists(join(root, "alpha"));
    writePluginAllowlists(join(root, "beta"));

    expect(readAllowlist("alpha", "allowed-skills.txt")).toBe("a-skill\nz-skill\n");
    expect(readAllowlist("alpha", "allowed-references.txt")).toBe(
      "a-skill\\assets\\sample.json\n" +
      "a-skill\\references\\nested\\a.md\n" +
      "a-skill\\scripts\\helper.ps1\n" +
      "z-skill\\references\\z.md\n",
    );
    expect(readAllowlist("beta", "allowed-skills.txt")).toBe("other-skill\n");
    expect(readAllowlist("beta", "allowed-references.txt")).toBe("other-skill\\references\\other.md\n");

    for (const filename of ["allowed-skills.txt", "allowed-references.txt"]) {
      const bytes = readFileSync(join(root, "alpha", "hooks", "allowlists", filename));
      expect(bytes.includes(13)).toBe(false);
      expect(bytes.subarray(0, 3)).not.toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(bytes.at(-1)).toBe(10);
    }
  });

  it("replaces previous contents when files and skills are removed", () => {
    write("plugin/skills/first/SKILL.md");
    write("plugin/skills/first/references/removed.md");
    write("plugin/skills/second/SKILL.md");
    const pluginDir = join(root, "plugin");
    writePluginAllowlists(pluginDir);
    const firstSkills = readAllowlist("plugin", "allowed-skills.txt");
    const firstReferences = readAllowlist("plugin", "allowed-references.txt");
    writePluginAllowlists(pluginDir);
    expect(readAllowlist("plugin", "allowed-skills.txt")).toBe(firstSkills);
    expect(readAllowlist("plugin", "allowed-references.txt")).toBe(firstReferences);

    rmSync(join(pluginDir, "skills", "first"), { recursive: true });
    writePluginAllowlists(pluginDir);
    expect(readAllowlist("plugin", "allowed-skills.txt")).toBe("second\n");
    expect(readAllowlist("plugin", "allowed-references.txt")).toBe("");
  });

  it.each(["missing", "empty"])("writes empty files for a %s skills tree", (kind) => {
    mkdirSync(join(root, "plugin"));
    if (kind === "empty") {
      mkdirSync(join(root, "plugin", "skills"));
    }
    writePluginAllowlists(join(root, "plugin"));
    expect(readAllowlist("plugin", "allowed-skills.txt")).toBe("");
    expect(readAllowlist("plugin", "allowed-references.txt")).toBe("");
  });

  it("skips linked skill and supporting-file directories", () => {
    write("plugin/skills/skill/SKILL.md");
    write("outside/private.md");
    const linkType = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(join(root, "outside"), join(root, "plugin", "skills", "linked-skill"), linkType);
    symlinkSync(join(root, "outside"), join(root, "plugin", "skills", "skill", "linked"), linkType);
    expect(collectPluginAllowlists(join(root, "plugin", "skills"))).toEqual({
      skills: ["skill"],
      references: [],
    });
  });

  it("surfaces read and write errors rather than treating them as empty lists", () => {
    write("not-a-directory");
    expect(() => collectPluginAllowlists(join(root, "not-a-directory"))).toThrow();
    expect(() => writePluginAllowlists(join(root, "nonexistent-plugin"))).toThrow();
    write("plugin/skills/skill/SKILL.md");
    mkdirSync(join(root, "plugin", "hooks", "allowlists", "allowed-skills.txt"), { recursive: true });
    expect(() => writePluginAllowlists(join(root, "plugin"))).toThrow();
  });
});

describe("Gulp allowlist packaging", () => {
  function run(command: string, args: string[]): void {
    const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.error?.message ?? (result.stderr || result.stdout));
    }
  }

  function prepareBuild(): void {
    copyFileSync(join(REPO_ROOT, "gulpfile.ts"), join(root, "gulpfile.ts"));
    mkdirSync(join(root, "scripts", "src"), { recursive: true });
    copyFileSync(
      join(REPO_ROOT, "scripts", "src", "plugin-allowlists.cts"),
      join(root, "scripts", "src", "plugin-allowlists.cts"),
    );
    symlinkSync(
      join(REPO_ROOT, "node_modules"),
      join(root, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );

    run("git", ["init", "--quiet", "--initial-branch=main"]);
    run("git", ["config", "user.name", "Allowlist Test"]);
    run("git", ["config", "user.email", "allowlist-test@example.com"]);
    run("git", ["remote", "add", "upstream", "https://github.com/example/plugins.git"]);
    write("README.md");
    run("git", ["add", "README.md"]);
    run("git", ["commit", "--quiet", "-m", "initial fixture"]);

    for (const plugin of ["alpha", "beta"]) {
      write(`plugins/${plugin}/version.json`, JSON.stringify({ version: "1.0" }));
      write(`plugins/${plugin}/hooks/scripts/pluginPathAllowPattern.sh`);
      write(`plugins/${plugin}/hooks/scripts/pluginPathAllowPattern.ps1`);
      write(`plugins/${plugin}/skills/${plugin}-skill/SKILL.md`, 'version: "0.0.0-placeholder"\n');
      write(`plugins/${plugin}/skills/${plugin}-skill/version.json`, "{}");
      write(`plugins/${plugin}/skills/${plugin}-skill/references/guide.md`);
    }
    for (const client of ["claude", "copilot", "cursor"]) {
      write(`hooks/${client}-hooks.json`, JSON.stringify({ hooks: {} }));
    }
    run("git", ["add", "plugins", "hooks"]);
    run("git", ["commit", "--quiet", "-m", "add fixture plugins"]);
  }

  function build() {
    const script = `
      require(${JSON.stringify(join(REPO_ROOT, "node_modules", "nerdbank-gitversioning"))}).getVersion =
        async () => ({ simpleVersion: "1.2.3" });
      require(${JSON.stringify(join(root, "gulpfile.ts"))}).default()
        .catch(error => { console.error(error); process.exitCode = 1; });
    `;
    return spawnSync(
      process.execPath,
      ["-r", join(REPO_ROOT, "node_modules", "ts-node", "register"), "-e", script],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, TS_NODE_PROJECT: join(REPO_ROOT, "tsconfig.json") },
      },
    );
  }

  it("generates files from packaged skills and removes stale entries on rebuild", () => {
    prepareBuild();
    write("plugins/alpha/hooks/allowlists/allowed-skills.txt", "stale-source-entry\n");
    write("plugins/alpha/hooks/allowlists/allowed-references.txt", "stale-source-entry\n");
    write("plugins/alpha/skills/alpha-skill/references/removed.md");
    const first = build();
    expect(first.error).toBeUndefined();
    expect(first.status, first.stderr || first.stdout).toBe(0);
    for (const plugin of ["alpha", "beta"]) {
      expect(readAllowlist(`output/${plugin}`, "allowed-skills.txt")).toBe(`${plugin}-skill\n`);
      expect(readAllowlist(`output/${plugin}`, "allowed-references.txt")).toBe(
        `${plugin}-skill\\references\\guide.md\n` +
        (plugin === "alpha" ? "alpha-skill\\references\\removed.md\n" : ""),
      );
      expect(read(`output/${plugin}`, `skills/${plugin}-skill/SKILL.md`)).toBe('version: "1.2.3"\n');
      for (const filename of ["allowed-skills.txt", "allowed-references.txt"]) {
        expect(existsSync(join(root, "output", plugin, filename))).toBe(false);
      }
    }
    rmSync(join(root, "plugins", "alpha", "skills", "alpha-skill", "references", "removed.md"));
    const second = build();
    expect(second.status, second.stderr || second.stdout).toBe(0);
    expect(readAllowlist("output/alpha", "allowed-references.txt")).toBe("alpha-skill\\references\\guide.md\n");
  }, 30_000);

  it("rejects the build when an allowlist cannot be written", () => {
    prepareBuild();
    write("plugins/alpha/hooks/allowlists/allowed-skills.txt/blocker");
    const result = build();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("allowed-skills.txt");
  }, 30_000);
});
