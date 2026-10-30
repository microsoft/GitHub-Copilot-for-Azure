import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const scriptsRoot = path.resolve(import.meta.dirname, "../../..");

describe("plugin and skill bootstrap", () => {
  let repoRoot: string | undefined;

  afterEach(() => {
    if (repoRoot) {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("bootstraps a plugin and skill in a new repository", () => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-bootstrap-"));
    execFileSync("git", ["init", "--quiet", repoRoot]);

    const pluginScriptsRoot = path.join(repoRoot, "scripts", "src", "plugin");
    fs.mkdirSync(pluginScriptsRoot, { recursive: true });
    for (const scriptName of ["bootstrap-plugin.ts", "bootstrap-skill.ts"]) {
      fs.copyFileSync(
        path.join(scriptsRoot, "src", "plugin", scriptName),
        path.join(pluginScriptsRoot, scriptName),
      );
    }

    // bootstrap-plugin.ts copies this file into every new plugin, so it must exist.
    fs.mkdirSync(path.join(repoRoot, "plugins", "azure-skills"), { recursive: true });
    fs.copyFileSync(
      path.join(scriptsRoot, "..", "plugins", "azure-skills", "LICENSE"),
      path.join(repoRoot, "plugins", "azure-skills", "LICENSE"),
    );

    fs.mkdirSync(path.join(repoRoot, "tests"));
    fs.writeFileSync(path.join(repoRoot, "tests", "skills.json"), JSON.stringify({ plugins: [] }));

    const sharedHooksRoot = path.join(repoRoot, "hooks", "scripts");
    fs.mkdirSync(sharedHooksRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sharedHooksRoot, "track-telemetry.sh"),
      "#!/usr/bin/env bash\n# shared hook sentinel\n",
    );

    fs.mkdirSync(path.join(repoRoot, ".github"));
    fs.writeFileSync(
      path.join(repoRoot, ".github", "CODEOWNERS"),
      "# Plugin skills owners (multi-plugin)\n\n# Plugin skills evals owners (multi-plugin)\n",
    );

    execFileSync(
      process.execPath,
      [tsxCli, path.join(pluginScriptsRoot, "bootstrap-plugin.ts"), "--plugin", "test-plugin"],
      { cwd: repoRoot, stdio: "inherit", timeout: 30_000 },
    );
    execFileSync(
      process.execPath,
      [
        tsxCli,
        path.join(pluginScriptsRoot, "bootstrap-skill.ts"),
        "--plugin",
        "test-plugin",
        "--skill",
        "test-skill",
      ],
      { cwd: repoRoot, stdio: "inherit", timeout: 30_000 },
    );

    const pluginRoot = path.join(repoRoot, "plugins", "test-plugin");
    const portableManifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));
    expect(portableManifest.$schema).toBe("https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    expect(portableManifest.name).toBe("test-plugin");
    expect(portableManifest.version).toBe("0.0.0-placeholder");
    for (const field of ["skills", "mcpServers", "hooks"]) {
      expect(portableManifest).not.toHaveProperty(field);
    }
    expect(JSON.parse(fs.readFileSync(path.join(pluginRoot, "mcp.json"), "utf8"))).toEqual({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {},
    });
    expect(fs.existsSync(path.join(pluginRoot, ".plugin", "plugin.json"))).toBe(true);
    expect(fs.existsSync(path.join(pluginRoot, ".claude-plugin", "plugin.json"))).toBe(true);
    expect(fs.existsSync(path.join(pluginRoot, ".cursor-plugin", "plugin.json"))).toBe(true);
    expect(fs.existsSync(path.join(pluginRoot, ".mcp.json"))).toBe(true);

    const readme = fs.readFileSync(path.join(pluginRoot, "README.md"), "utf8");
    expect(readme).toBe(`# <Your Plugin>

## Telemetry

The \`track-telemetry\` hook installs a pinned native \`ghcfa-telem\` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
\`AZURE_MCP_COLLECT_TELEMETRY=false\` in the environment of the process running
the agent.
`);
    expect(readme).toContain("ghcfa-telem");
    expect(readme).not.toContain("npx");

    const versionManifest = JSON.parse(
      fs.readFileSync(path.join(pluginRoot, "version.json"), "utf8"),
    ) as { pathFilters: string[] };
    expect(versionManifest.pathFilters).toEqual([".", ":/hooks"]);

    expect(fs.existsSync(path.join(pluginRoot, "skills", "test-skill", "SKILL.md"))).toBe(true);

    expect(fs.existsSync(path.join(repoRoot, "evals", "test-plugin", "test-skill", "eval.yaml"))).toBe(true);
    const unitTest = fs.readFileSync(
      path.join(repoRoot, "tests", "skills", "test-plugin", "test-skill", "test-skill.test.ts"),
      "utf8",
    );
    expect(unitTest).toContain("Add unit tests for your skill or remove this file if it doesn't need unit tests.");
    expect(unitTest).toContain("expect(true).toBe(true)");

    const bashAllowlist = fs.readFileSync(
      path.join(pluginRoot, "hooks", "scripts", "pluginPathAllowPattern.sh"),
      "utf8",
    );
    const powershellAllowlist = fs.readFileSync(
      path.join(pluginRoot, "hooks", "scripts", "pluginPathAllowPattern.ps1"),
      "utf8",
    );
    expect(bashAllowlist).toContain("# --- test-plugin plugin ---");
    expect(powershellAllowlist).toContain("# --- test-plugin plugin ---");
    expect(
      fs.readFileSync(path.join(sharedHooksRoot, "track-telemetry.sh"), "utf8"),
    ).toBe("#!/usr/bin/env bash\n# shared hook sentinel\n");
    expect(fs.readdirSync(sharedHooksRoot)).toEqual(["track-telemetry.sh"]);

    const skillsConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "tests", "skills.json"), "utf8"),
    ) as { plugins: Array<{ dirname: string; skills: string[] }> };
    const pluginEntry = skillsConfig.plugins.find((entry) => entry.dirname === "test-plugin");
    expect(pluginEntry?.skills).toContain("test-skill");
  });
});