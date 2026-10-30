import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const gulpfile = join(repoRoot, "gulpfile.ts");
const tsNodeRegister = join(repoRoot, "node_modules", "ts-node", "register");
const pluginName = "test-plugin";
const clientManifestDirectories = [".", ".plugin", ".cursor-plugin", ".claude-plugin"];

let fixtureRoot: string;
let outputRoot: string;

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(path: string, value: unknown): void {
  write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function updateManifest(directory: string, changes: Record<string, unknown>): void {
  const file = join(outputRoot, pluginName, directory, "plugin.json");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  writeJson(file, { ...manifest, ...changes });
}

function assemblePluginHooks(): ReturnType<typeof spawnSync> {
  const script = `
    const { assemblePluginHooks } = require(${JSON.stringify(gulpfile)});
    assemblePluginHooks(${JSON.stringify(pluginName)}, {
      repositoryRoot: ${JSON.stringify(fixtureRoot)},
      outputRoot: ${JSON.stringify(outputRoot)},
    });
  `;
  return spawnSync(process.execPath, ["-r", tsNodeRegister, "-e", script], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      TS_NODE_PROJECT: join(repoRoot, "tsconfig.json"),
    },
  });
}

function expectAssemblySuccess(): void {
  const result = assemblePluginHooks();
  expect(result.status, String(result.stderr || result.stdout)).toBe(0);
}

function metadataLines(): string[] {
  return readFileSync(
    join(outputRoot, pluginName, "hooks", "metadata.txt"),
    "utf8",
  ).trimEnd().split("\n");
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "hook-metadata-"));
  outputRoot = join(fixtureRoot, "output");

  for (const manifestName of [
    "claude-hooks.json",
    "copilot-hooks.json",
    "cursor-hooks.json",
  ]) {
    writeJson(join(fixtureRoot, "hooks", manifestName), { hooks: {} });
  }

  for (const scriptName of [
    "pluginPathAllowPattern.ps1",
    "pluginPathAllowPattern.sh",
  ]) {
    write(
      join(
        fixtureRoot,
        "plugins",
        pluginName,
        "hooks",
        "scripts",
        scriptName,
      ),
      "fixture\n",
    );
  }

  for (const manifestDirectory of clientManifestDirectories) {
    const hookManifest = {
      ".plugin": "copilot-hooks.json",
      ".cursor-plugin": "cursor-hooks.json",
      ".claude-plugin": "claude-hooks.json",
    }[manifestDirectory];
    writeJson(
      join(outputRoot, pluginName, manifestDirectory, "plugin.json"),
      {
        name: "shared-plugin-name",
        version: "4.5.6",
        description: "Shared plugin description",
        author: { name: "Microsoft", url: "https://www.microsoft.com" },
        homepage: "https://example.com/plugin",
        repository: "https://example.com/repository",
        license: "MIT",
        keywords: ["azure", "cloud"],
        ...(hookManifest ? {
          skills: "./skills/",
          mcpServers: "./.mcp.json",
          hooks: `./hooks/${hookManifest}`,
        } : {
          $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        }),
      },
    );
  }
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("generated hook metadata", () => {
  it("uses the shared stamped identity and sorts configured MCP servers", () => {
    writeJson(join(outputRoot, pluginName, ".mcp.json"), {
      mcpServers: {
        zeta: { command: "zeta" },
        azure: { type: "http", url: "https://example.com/mcp" },
      },
    });
    writeJson(join(outputRoot, pluginName, "mcp.json"), {
      mcpServers: {
        zeta: { type: "stdio", command: "zeta" },
        azure: { type: "streamable-http", url: "https://example.com/mcp" },
      },
    });

    expectAssemblySuccess();

    expect(metadataLines()).toEqual([
      "plugin-name=shared-plugin-name",
      "plugin-version=4.5.6",
      "mcp-server=azure",
      "mcp-server=zeta",
    ]);
  });

  it("emits no MCP server entries for empty or absent configuration", () => {
    writeJson(join(outputRoot, pluginName, ".mcp.json"), { mcpServers: {} });
    expectAssemblySuccess();
    expect(metadataLines()).toEqual([
      "plugin-name=shared-plugin-name",
      "plugin-version=4.5.6",
    ]);

    rmSync(join(outputRoot, pluginName, ".mcp.json"));
    expectAssemblySuccess();
    expect(metadataLines()).toEqual([
      "plugin-name=shared-plugin-name",
      "plugin-version=4.5.6",
    ]);
  });

  it("rejects client manifests with different stamped identity", () => {
    writeJson(
      join(outputRoot, pluginName, ".cursor-plugin", "plugin.json"),
      { name: "different-name", version: "4.5.6" },
    );

    const result = assemblePluginHooks();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Built plugin manifests for test-plugin must use the same name and version",
    );
  });

  it("rejects a portable manifest with different stamped identity", () => {
    writeJson(join(outputRoot, pluginName, "plugin.json"), {
      name: "shared-plugin-name", version: "9.0.0",
    });
    const result = assemblePluginHooks();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must use the same name and version");
  });

  it("rejects portable and legacy MCP configuration drift", () => {
    writeJson(join(outputRoot, pluginName, "mcp.json"), {
      mcpServers: { azure: { type: "stdio", command: "npx" } },
    });
    const result = assemblePluginHooks();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must declare equivalent servers");
  });

  it.each([".plugin", ".claude-plugin", ".cursor-plugin"])(
    "rejects shared metadata drift in %s",
    directory => {
      for (const [field, changed] of Object.entries({
        author: { name: "Microsoft", url: "https://different.example.com" },
        homepage: "https://different.example.com",
        repository: "https://different.example.com/repository",
        license: "Apache-2.0",
        keywords: ["azure", "different"],
      })) {
        const file = join(outputRoot, pluginName, directory, "plugin.json");
        const original = readFileSync(file, "utf8");
        updateManifest(directory, { [field]: changed });
        const result = assemblePluginHooks();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`${directory}/plugin.json field "${field}" is out of sync`);
        write(file, original);
      }
    }, 30_000,
  );

  it.each([".plugin", ".claude-plugin", ".cursor-plugin"])(
    "rejects missing shared metadata in %s",
    directory => {
      updateManifest(directory, { author: undefined });
      const result = assemblePluginHooks();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('field "author" is out of sync');
      expect(result.stderr).toContain("found a missing field");
    },
  );

  it("compares Copilot descriptions with the portable manifest", () => {
    updateManifest(".plugin", { description: "Outdated description" });
    const result = assemblePluginHooks();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('.plugin/plugin.json field "description" is out of sync');
  });

  it("rejects stale legacy metadata when the portable manifest changes", () => {
    updateManifest(".", { homepage: "https://new.example.com" });
    const result = assemblePluginHooks();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('.plugin/plugin.json field "homepage" is out of sync');
    expect(result.stderr).toContain('expected "https://new.example.com"');
  });

  it.each([".plugin", ".claude-plugin", ".cursor-plugin"])(
    "rejects incorrect component paths in %s",
    directory => {
      for (const [field, changed] of Object.entries({
        skills: "./other-skills/",
        mcpServers: "./mcp.json",
        hooks: "./hooks/wrong-client.json",
      })) {
        const file = join(outputRoot, pluginName, directory, "plugin.json");
        const original = readFileSync(file, "utf8");
        updateManifest(directory, { [field]: changed });
        const result = assemblePluginHooks();
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`${directory}/plugin.json field "${field}" is out of sync`);
        write(file, original);
      }
    }, 30_000,
  );

  it("allows client-specific descriptions, extensions, logos, and object key ordering", () => {
    updateManifest(".claude-plugin", { description: "Manage Azure from Claude Code." });
    updateManifest(".cursor-plugin", {
      description: "Manage Azure from Cursor.",
      logo: "./assets/azure-logo.svg",
    });
    updateManifest(".", { extensions: { "com.openai": { setting: true } } });
    updateManifest(".plugin", {
      author: { url: "https://www.microsoft.com", name: "Microsoft" },
    });
    expectAssemblySuccess();
  });

  it("copies only compiled copilot-hooks.json into the namespace and refreshes it", () => {
    const shared = { type: "command", bash: "${PLUGIN_ROOT}/hooks/scripts/shared.sh" };
    const local = { type: "command", bash: "${PLUGIN_ROOT}/hooks/scripts/local.sh" };
    writeJson(join(fixtureRoot, "hooks", "copilot-hooks.json"), {
      hooks: { SessionStart: [shared] },
    });
    writeJson(join(fixtureRoot, "hooks", "claude-hooks.json"), {
      hooks: { ClaudeOnly: [{ command: "claude" }] },
    });
    writeJson(join(fixtureRoot, "hooks", "cursor-hooks.json"), {
      hooks: { CursorOnly: [{ command: "cursor" }] },
    });
    const fragment = join(fixtureRoot, "plugins", pluginName, "hooks", "copilot-hooks.json");
    writeJson(fragment, { hooks: { SessionStart: [local], PostToolUse: [local] } });

    expectAssemblySuccess();

    const portablePath = join(outputRoot, pluginName, "com.github.copilot", "hooks", "hooks.json");
    const legacyPath = join(outputRoot, pluginName, "hooks", "copilot-hooks.json");
    expect(readFileSync(portablePath)).toEqual(readFileSync(legacyPath));
    expect(JSON.parse(readFileSync(portablePath, "utf8"))).toEqual({
      hooks: { SessionStart: [shared, local], PostToolUse: [local] },
    });
    rmSync(fragment);
    expectAssemblySuccess();
    expect(readFileSync(portablePath)).toEqual(readFileSync(legacyPath));
    expect(JSON.parse(readFileSync(portablePath, "utf8"))).toEqual({
      hooks: { SessionStart: [shared] },
    });
  });

  it.each([
    {
      name: "malformed portable MCP configuration JSON",
      arrange: () =>
        write(join(outputRoot, pluginName, "mcp.json"), '{"mcpServers":'),
      error: "Invalid JSON in built MCP configuration",
    },
    {
      name: "malformed client manifest JSON",
      arrange: () =>
        write(
          join(outputRoot, pluginName, ".plugin", "plugin.json"),
          '{"name":',
        ),
      error: "Invalid JSON in built plugin manifest",
    },
    {
      name: "malformed MCP configuration JSON",
      arrange: () =>
        write(join(outputRoot, pluginName, ".mcp.json"), '{"mcpServers":'),
      error: "Invalid JSON in built MCP configuration",
    },
    {
      name: "non-object mcpServers",
      arrange: () =>
        writeJson(join(outputRoot, pluginName, ".mcp.json"), {
          mcpServers: [],
        }),
      error: 'field "mcpServers" must contain a JSON object',
    },
  ])("rejects $name", ({ arrange, error }) => {
    arrange();

    const result = assemblePluginHooks();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
  });
});
