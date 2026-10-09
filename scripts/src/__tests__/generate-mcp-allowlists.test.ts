import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPTS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATOR = join(SCRIPTS_ROOT, "src", "generate-mcp-allowlists.ts");
let root: string;
let output: string;

function write(relativePath: string, content = "fixture\n"): void {
  const file = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function generate(...skillsDirs: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", GENERATOR, ...skillsDirs, output], {
    cwd: SCRIPTS_ROOT,
    encoding: "utf8",
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "mcp allowlists-"));
  output = join(root, "output");
  mkdirSync(output);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("MCP allowlist generation", () => {
  it("preserves the multi-plugin schemas, sorting, exclusions, and Windows reference paths", () => {
    write("z-plugin/skills/z-skill/SKILL.md");
    write("z-plugin/skills/z-skill/version.json", "{}");
    write("z-plugin/skills/z-skill/references/z.md");
    write("z-plugin/skills/a-skill/SKILL.md");
    write("z-plugin/skills/a-skill/references/a.md");
    write("z-plugin/skills/a-skill/scripts/helper.ps1");
    write("z-plugin/skills/.hidden/SKILL.md");
    write("z-plugin/skills/not-a-skill.txt");
    for (const excluded of ["SKILL.md", "version.json", "LICENSE", "LICENSE.txt", "LICENSE.md"]) {
      write(`z-plugin/skills/a-skill/references/${excluded}`);
    }
    write("a-plugin/skills/other-skill/SKILL.md");
    write("a-plugin/skills/other-skill/references/nested/file.md");
    const skillsDirs = [join(root, "z-plugin", "skills"), join(root, "a-plugin", "skills")];
    const result = generate(...skillsDirs);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const expected = [
      {
        file: "allowed-skill-names.json",
        data: { skills: { "z-plugin": ["a-skill", "z-skill"], "a-plugin": ["other-skill"] } },
      },
      {
        file: "allowed-plugin-file-references.json",
        data: {
          references: {
            "z-plugin": [
              "a-skill\\references\\a.md",
              "a-skill\\scripts\\helper.ps1",
              "z-skill\\references\\z.md",
            ],
            "a-plugin": ["other-skill\\references\\nested\\file.md"],
          },
        },
      },
    ];
    for (const { file, data } of expected) {
      expect(readFileSync(join(output, file), "utf8")).toBe(JSON.stringify(data, null, 2) + "\n");
    }
    expect(generate(...skillsDirs).status).toBe(0);
    for (const { file, data } of expected) {
      expect(readFileSync(join(output, file), "utf8")).toBe(JSON.stringify(data, null, 2) + "\n");
    }
  });

  it("does not traverse linked reference directories", () => {
    write("plugin/skills/skill/SKILL.md");
    write("outside/private.md");
    symlinkSync(
      join(root, "outside"),
      join(root, "plugin", "skills", "skill", "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const result = generate(join(root, "plugin", "skills"));
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(output, "allowed-plugin-file-references.json"), "utf8")))
      .toEqual({ references: { plugin: [] } });
  });

  it.each(["missing", "empty"])("fails without generating output for a %s skills directory", kind => {
    const skillsDir = join(root, "plugin", "skills");
    if (kind === "empty") {
      mkdirSync(skillsDir, { recursive: true });
    }
    const result = generate(skillsDir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(kind === "missing" ? "skills directory not found" : "No skills found");
    expect(existsSync(join(output, "allowed-skill-names.json"))).toBe(false);
    expect(existsSync(join(output, "allowed-plugin-file-references.json"))).toBe(false);
  });
});
