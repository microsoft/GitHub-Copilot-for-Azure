import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const pluginsRoot = join(repoRoot, "plugins");
const plugins = readdirSync(pluginsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);
const schemaRoot = "https://agent-plugins.org/schemas/1.0.0";

function readObject(file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${file}`);
  }
  return value as Record<string, unknown>;
}

function normalizeLegacyMcpRoots(legacy: unknown, portable: unknown): unknown {
  if (typeof legacy === "string" && typeof portable === "string") {
    return legacy === portable
      ? legacy
      : legacy.replaceAll("${CLAUDE_PLUGIN_ROOT}", "${PLUGIN_ROOT}");
  }
  if (Array.isArray(legacy) && Array.isArray(portable)) {
    return legacy.map((value, index) => normalizeLegacyMcpRoots(value, portable[index]));
  }
  if (
    typeof legacy === "object" && legacy !== null && !Array.isArray(legacy) &&
    typeof portable === "object" && portable !== null && !Array.isArray(portable)
  ) {
    const portableObject = portable as Record<string, unknown>;
    return Object.fromEntries(Object.entries(legacy).map(([key, value]) => [
      key, normalizeLegacyMcpRoots(value, portableObject[key]),
    ]));
  }
  return legacy;
}

describe("Agent Plugins 1.0.0 packages", () => {
  it.each(plugins)("%s has a portable manifest matching its legacy metadata", plugin => {
    const root = join(pluginsRoot, plugin);
    const portable = readObject(join(root, "plugin.json"));
    const legacy = readObject(join(root, ".plugin", "plugin.json"));
    const { skills, mcpServers, hooks, ...metadata } = legacy;
    expect(skills).toBe("./skills/");
    expect(mcpServers).toBe("./.mcp.json");
    expect(hooks).toBe("./hooks/copilot-hooks.json");
    expect(portable).toEqual({ $schema: `${schemaRoot}/plugin.schema.json`, ...metadata });

    // Closed fields and constraints from the canonical 1.0.0 manifest schema.
    const allowed = [
      "$schema", "name", "version", "description", "author",
      "homepage", "repository", "license", "keywords", "extensions",
    ];
    expect(Object.keys(portable).every(key => allowed.includes(key))).toBe(true);
    expect(portable.name).toEqual(expect.stringMatching(/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/));
    expect(String(portable.name).length).toBeLessThanOrEqual(64);
    expect(portable.version).toBe("0.0.0-placeholder");
    for (const field of ["description", "homepage", "repository", "license"]) {
      expect(typeof portable[field]).toBe("string");
    }
    expect(portable.author).toEqual({
      name: expect.any(String), url: expect.any(String),
    });
    expect(Array.isArray(portable.keywords)).toBe(true);
    for (const keyword of portable.keywords as unknown[]) {
      expect(typeof keyword).toBe("string");
    }
    for (const directory of [".claude-plugin", ".cursor-plugin"]) {
      const client = readObject(join(root, directory, "plugin.json"));
      expect(client.name).toBe(portable.name);
      expect(client.version).toBe(portable.version);
    }
  });

  it.each(plugins)("%s has portable MCP configuration equivalent to .mcp.json", plugin => {
    const root = join(pluginsRoot, plugin);
    const portable = readObject(join(root, "mcp.json"));
    const legacyServers = readObject(join(root, ".mcp.json")).mcpServers;
    expect(typeof legacyServers).toBe("object");
    const normalized: Record<string, Record<string, unknown>> = Object.fromEntries(
      Object.entries(legacyServers as Record<string, Record<string, unknown>>)
        .map(([name, server]) => [name, {
          ...server,
          type: server.type === "http" ? "streamable-http" : server.type ?? "stdio",
        }]),
    );
    expect(portable).toEqual({
      $schema: `${schemaRoot}/mcp.schema.json`,
      mcpServers: normalizeLegacyMcpRoots(normalized, portable.mcpServers),
    });
    for (const server of Object.values(normalized)) {
      if (server.type === "stdio") {
        expect(Object.keys(server).every(key => ["type", "command", "args", "env", "cwd"].includes(key))).toBe(true);
        expect(server.command).toEqual(expect.stringMatching(/^[a-zA-Z0-9_-]+$/));
        expect(Array.isArray(server.args)).toBe(true);
        for (const arg of server.args as unknown[]) {
          expect(typeof arg).toBe("string");
        }
      } else {
        expect(["streamable-http", "sse"]).toContain(server.type);
        expect(Object.keys(server).every(key => ["type", "url", "headers"].includes(key))).toBe(true);
        const url = new URL(String(server.url));
        expect(url.protocol).toBe("https:");
        expect(url.username + url.password + url.hash).toBe("");
        expect(server.headers).toEqual({ "x-mcp-toolset": "CostManagement" });
      }
    }
  });

  it("publishes portable and legacy files in the Azure Skills repository root", () => {
    const workflow = readFileSync(join(repoRoot, ".github", "workflows", "publish-to-marketplace.yml"), "utf8");
    const copyStep = workflow.split("- name: Copy azure plugin files to repo root")[1]
      .split("# 6. Replace repository URLs")[0];
    for (const file of ["plugin.json", "mcp.json", ".mcp.json", ".plugin/plugin.json", ".claude-plugin/plugin.json"]) {
      expect(copyStep).toContain(`cp "source-repo/output/azure-skills/${file}" "target-repo/${file}"`);
    }
    expect(copyStep).toContain('"source-repo/output/azure-skills/com.github.copilot/" "target-repo/com.github.copilot/"');
    expect(workflow).toContain('"target-repo/com.github.copilot/" "target-repo/plugin.json" "target-repo/mcp.json"');
  });
});

describe("MCP client root normalization", () => {
  it("normalizes nested client-specific roots and preserves identical values", () => {
    const legacy = {
      args: ["${CLAUDE_PLUGIN_ROOT}/graph/runtime/launch-python.mjs"],
      env: { shared: "${CLAUDE_PLUGIN_ROOT}/shared" },
    };
    const portable = {
      args: ["${PLUGIN_ROOT}/graph/runtime/launch-python.mjs"],
      env: { shared: "${CLAUDE_PLUGIN_ROOT}/shared" },
    };
    expect(normalizeLegacyMcpRoots(legacy, portable)).toEqual(portable);
  });

  it.each([
    {
      name: "different launcher paths",
      legacy: "${CLAUDE_PLUGIN_ROOT}/graph/runtime/launch-python.mjs",
      portable: "${PLUGIN_ROOT}/graph/runtime/other.mjs",
    },
    {
      name: "swapped client roots",
      legacy: "${PLUGIN_ROOT}/graph/runtime/launch-python.mjs",
      portable: "${CLAUDE_PLUGIN_ROOT}/graph/runtime/launch-python.mjs",
    },
  ])("rejects $name", ({ legacy, portable }) => {
    expect(normalizeLegacyMcpRoots(legacy, portable)).not.toEqual(portable);
  });
});
