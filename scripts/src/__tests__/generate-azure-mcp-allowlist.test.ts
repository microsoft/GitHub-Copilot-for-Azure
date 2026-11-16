import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discover, listServerTools, mergeAllowlist, parseAllowlist, parseCommandOutput,
  parseDiscovery, resolveRelease, selectRelease, updatePin, updatePlugins,
  type Discovery, type Release,
} from "../generate-azure-mcp-allowlist.js";

const temporary: string[] = [];
const discovery: Discovery = { version: "4.0.0-beta.4", commands: ["storage_get", "subscription_list"], areas: ["storage"] };
const empty = () => ({ commands: {}, areas: {}, extensionTools: {} });

async function temp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "azure-mcp-allowlist-"));
  temporary.push(root);
  return root;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

function release(version = "4.0.0-beta.4", published = "2026-10-25T00:00:00Z"): Release {
  return {
    tag_name: `Azure.Mcp.Server-${version}`, draft: false, published_at: published,
    assets: [{
      name: "Azure.Mcp.Server-linux-x64.zip",
      browser_download_url: `https://github.com/microsoft/mcp/releases/download/Azure.Mcp.Server-${version}/Azure.Mcp.Server-linux-x64.zip`,
      digest: null,
    }],
  };
}

describe("release resolution", () => {
  it("selects the newest published Azure product release, including beta tags", () => {
    expect(selectRelease([
      { ...release("9.0.0"), draft: true },
      { ...release(), tag_name: "Fabric.Mcp.Server-20.0.0" },
      release("4.0.0", "2026-10-01T00:00:00Z"),
      release("4.1.0-beta.1", "2026-10-26T00:00:00Z"),
    ]).version).toBe("4.1.0-beta.1");
  });

  it("pages past other products and fails HTTP errors", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...release(), tag_name: "Fabric.Mcp.Server-1.0.0" }]), {
        headers: { link: '<https://api.github.com/next>; rel="next"' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([release()])));
    vi.stubGlobal("fetch", fetch);
    expect((await resolveRelease()).version).toBe(discovery.version);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain("page=2");
    fetch.mockResolvedValue(new Response("rate limited", { status: 403 }));
    await expect(resolveRelease()).rejects.toThrow("403");
  });

  it.each(([
    [],
    [{ ...release(), assets: [] }],
    [release("bad/../../tag")],
    [{ ...release(), published_at: null }],
    [{ ...release(), published_at: "invalid" }],
    [{ ...release(), assets: [{ ...release().assets[0], browser_download_url: "https://example.invalid/server.zip" }] }],
  ] satisfies Release[][]).map(releases => ({ releases })))("rejects incomplete or invalid releases: %j", ({ releases }) => {
    expect(() => selectRelease(releases)).toThrow();
  });
});

describe("strict grouped JSON", () => {
  it("accepts empty sections and descriptive labels, including special object keys", () => {
    expect(parseAllowlist(JSON.stringify(empty()))).toEqual(empty());
    const text = '{"commands":{"__proto__":["tool"]},"areas":{},"extensionTools":{"Azure extension":["helper"]}}';
    const parsed = parseAllowlist(text);
    expect(Object.keys(parsed.commands)).toEqual(["__proto__"]);
    expect(JSON.stringify(parsed)).toBe(text);
  });

  it.each([
    "", "[]", "null", "{}",
    '{"commands":{},"areas":{}}',
    '{"commands":{},"areas":{},"extensionTools":{},"other":{}}',
    '{"commands":{},"commands":{},"areas":{},"extensionTools":{}}',
    '{"commands":{},"\\u0063ommands":{},"areas":{},"extensionTools":{}}',
    '{"commands":[],"areas":{},"extensionTools":{}}',
    '{"commands":null,"areas":{},"extensionTools":{}}',
    '{"commands":{"Initial":[]},"areas":{},"extensionTools":{}}',
    '{"commands":{"Initial":"tool"},"areas":{},"extensionTools":{}}',
    '{"commands":{"Initial":[1]},"areas":{},"extensionTools":{}}',
    '{"commands":{},"areas":{"Initial":[" "]},"extensionTools":{}}',
    '{"commands":{},"areas":{},"extensionTools":{"Azure extension":[null]}}',
  ])("rejects malformed configuration: %s", text => {
    expect(() => parseAllowlist(text)).toThrow();
  });

  it("does not mistake structural characters inside names for duplicate sections", () => {
    const value = { commands: { 'label":{},': ['tool,":{}'] }, areas: {}, extensionTools: {} };
    expect(parseAllowlist(JSON.stringify(value))).toEqual(value);
  });

  it("preserves names from repeated group labels, as the reporter's reader does", () => {
    const parsed = parseAllowlist('{"commands":{"Initial":["old_a"],"Initial":["old_b"]},"areas":{},"extensionTools":{}}');
    expect(parsed.commands.Initial).toEqual(["old_a", "old_b"]);
    expect(() => parseAllowlist('{"commands":{"Initial":42,"Initial":["old_b"]},"areas":{},"extensionTools":{}}')).toThrow();
    expect(() => parseAllowlist('{"commands":{"Initial":[],"Initial":["old_b"]},"areas":{},"extensionTools":{}}')).toThrow();
  });

  it("preserves historical membership, case and helpers while extending an existing version", () => {
    const original = {
      commands: { Initial: ["old_tool", "Storage_get"], [discovery.version]: ["subscription_list"] },
      areas: { "Next release": ["old_area"] },
      extensionTools: { Helpers: ["custom_helper"] },
    };
    const merged = mergeAllowlist(original, discovery);
    expect(merged.commands.Initial).toEqual(original.commands.Initial);
    expect(merged.commands[discovery.version]).toEqual(["storage_get", "subscription_list"]);
    expect(merged.areas["Next release"]).toEqual(["old_area"]);
    expect(merged.extensionTools).toEqual(original.extensionTools);
    expect(mergeAllowlist(merged, discovery)).toEqual(merged);
    expect(original.commands[discovery.version]).toEqual(["subscription_list"]);
  });

  it("preserves empty sections and historical groups without seeding helpers", () => {
    expect(mergeAllowlist(empty(), { ...discovery, commands: [], areas: [] })).toEqual(empty());
    expect(mergeAllowlist(empty(), discovery).extensionTools).toEqual({});
    const historical = { ...empty(), commands: { Initial: ["storage_get"], "Some release": ["subscription_list"] }, areas: { Initial: ["storage"] } };
    expect(mergeAllowlist(historical, discovery)).toEqual(historical);
  });

  it.each([
    { ...discovery, version: "latest" },
    { ...discovery, commands: [] },
    { ...discovery, areas: [] },
    { ...discovery, commands: ["azure-storage"] },
    { ...discovery, areas: ["mcp_azure_mcp_storage"] },
    { ...discovery, areas: ["storage get"] },
    { ...discovery, areas: ["storage_get"] },
  ])("rejects unsafe or incomplete discovery: %j", data => {
    expect(() => parseDiscovery(data)).toThrow();
  });
});

describe("release tool discovery", () => {
  it("verifies supplied asset digests and reports when one is unavailable", async () => {
    const root = await temp();
    const archive = join(root, "asset.zip");
    const metadata = join(root, "release.json");
    const script = fileURLToPath(new URL("../generate-azure-mcp-allowlist.ts", import.meta.url));
    await writeFile(archive, "fixture archive");
    for (const digest of [
      `sha256:${createHash("sha256").update("fixture archive").digest("hex")}`,
      `sha256:${"0".repeat(64)}`, null, "unsupported:digest",
    ]) {
      await writeFile(metadata, JSON.stringify({ digest }));
      const result = spawnSync(process.execPath, [
        "--import", "tsx", script, "verify-asset", "--release", metadata, "--archive", archive,
      ], { cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8" });
      if (digest === null) {
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain("no asset digest");
      } else if (digest.endsWith("0".repeat(64)) || digest === "unsupported:digest") {
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/digest/);
      } else expect(result.status, result.stderr).toBe(0);
    }
    await writeFile(metadata, '{"digest":null}');
    const missing = spawnSync(process.execPath, [
      "--import", "tsx", script, "verify-asset", "--release", metadata,
    ], { cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8" });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Missing option --archive");
  });

  it("parses the exact command listing response and rejects failure responses", () => {
    expect(parseCommandOutput('{"status":200,"results":{"names":["b","a","a"]}}')).toEqual(["a", "b"]);
    for (const text of [
      '{"status":500,"results":{"names":["a"]}}', '{"status":200,"results":{"names":[]}}',
      '{"status":200,"results":[]}', 'banner\n{"status":200}', '{"status":200,"results":{"names":[null]}}',
    ]) expect(() => parseCommandOutput(text)).toThrow();
  });

  async function server(mode: string): Promise<string> {
    const path = join(await temp(), "server.cjs");
    await writeFile(path, `
const readline = require("node:readline");
const mode = ${JSON.stringify(mode)};
readline.createInterface({input: process.stdin}).on("line", line => {
  const message = JSON.parse(line);
  if (mode === "timeout") return;
  if (mode === "exit") process.exit(3);
  if (mode === "malformed") { console.log("invalid JSON"); return; }
  if (message.method === "initialize") {
    console.log(JSON.stringify({jsonrpc:"2.0",id:message.id,result:{protocolVersion:"2024-11-05",capabilities:{}}}));
  } else if (message.method === "tools/list") {
    if (mode === "error") {
      console.log(JSON.stringify({jsonrpc:"2.0",id:message.id,error:{code:-1,message:"listing failed"}}));
    } else {
      const tools = mode === "empty" ? [] : [{name:message.params.cursor ? "extension_cli_install" : "storage"}];
      const nextCursor = mode === "repeat" || !message.params.cursor ? "second" : undefined;
      console.log(JSON.stringify({jsonrpc:"2.0",id:message.id,result:{tools,nextCursor}}));
    }
  }
});
`);
    return path;
  }

  it("initializes and follows tools/list pagination, then stops the process", async () => {
    expect(await listServerTools(process.execPath, 5000, [await server("success")]))
      .toEqual(["extension_cli_install", "storage"]);
  });

  it.each([
    ["repeat", "pagination cursor"], ["empty", "no tools"], ["error", "listing failed"],
    ["exit", "exited before discovery"], ["malformed", "Unexpected token"], ["timeout", "Timed out"],
  ])("fails and cleans up on %s", async (mode, message) => {
    await expect(listServerTools(process.execPath, mode === "timeout" ? 300 : 5000, [await server(mode)]))
      .rejects.toThrow(message);
  });

  it("rejects an unavailable npm package before executing the release", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));
    await expect(discover("not-an-executable", selectRelease([release()]).version)).rejects.toThrow("404");
  });

  it("reports a missing executable instead of leaving a discovery process running", async () => {
    await expect(listServerTools(join(await temp(), "missing-server"))).rejects.toThrow();
  });
});

describe("shared source refresh", () => {
  async function fixture(): Promise<string> {
    const root = await temp();
    for (const name of ["first", "second", "without-azure"]) {
      const plugin = join(root, "plugins", name);
      await mkdir(plugin, { recursive: true });
      await writeFile(join(plugin, "plugin.json"), "{}");
      const azure = { command: "npx", args: ["-y", "@azure/mcp@1.0.0", "server", "start", "--namespace", "storage"] };
      await writeFile(join(plugin, ".mcp.json"), JSON.stringify({ mcpServers: name === "without-azure" ? {} : { azure } }));
      await writeFile(join(plugin, "mcp.json"), JSON.stringify({ mcpServers: name === "without-azure" ? {} : { azure: { ...azure, type: "stdio" } } }));
      if (name === "first") {
        await writeFile(join(plugin, "gemini-extension.json"), JSON.stringify({ name, mcpServers: { azure } }));
      }
    }
    await writeFile(join(root, "plugins", "allowed-azure-tools.json"), JSON.stringify({
      commands: { Old: ["old_tool"], Earlier: ["storage_get"] },
      areas: { Older: ["retired_area"] },
      extensionTools: { Helpers: ["first_helper"] },
    }));
    await mkdir(join(root, "plugins", "not-a-plugin"));
    return root;
  }

  it("preserves formatting and non-Azure servers while updating only the package argument", () => {
    const text = '{ "mcpServers": { "other": {"args":["@azure/mcp@1.0.0"]}, "azure": {"command":"npx", "args":["-y","@azure/mcp@1.0.0","server","start"]} } }\n';
    const after = updatePin(text, discovery.version);
    expect(after).toBe(text.replace('"args":["-y","@azure/mcp@1.0.0"', `"args":["-y","@azure/mcp@${discovery.version}"`));
    expect(updatePin('{"mcpServers":{}}', discovery.version)).toBe('{"mcpServers":{}}');
    expect(() => updatePin('{"mcpServers":{"azure":{"args":["@azure/mcp"]}}}', discovery.version)).toThrow("pinned");
    const withMetadata = '{"metadata":{"azure":{"args":["@azure/mcp@1.0.0"]}},"mcpServers":{"azure":{"args":["@azure/mcp@1.0.0"]}}}';
    const parsed: { metadata: { azure: { args: string[] } }; mcpServers: { azure: { args: string[] } } } =
      JSON.parse(updatePin(withMetadata, discovery.version));
    expect(parsed.metadata.azure.args).toEqual(["@azure/mcp@1.0.0"]);
    expect(parsed.mcpServers.azure.args).toEqual([`@azure/mcp@${discovery.version}`]);
  });

  it("updates only the shared allowlist and existing MCP pins, without creating plugin-local copies", async () => {
    const root = await fixture();
    const changes = await updatePlugins(root, discovery);
    expect(changes).toHaveLength(6);
    const sharedPath = join(root, "plugins", "allowed-azure-tools.json");
    expect(changes).toContain(sharedPath);
    const shared = parseAllowlist(await readFile(sharedPath, "utf8"));
    expect(shared.commands.Old).toEqual(["old_tool"]);
    expect(shared.commands.Earlier).toEqual(["storage_get"]);
    expect(shared.commands[discovery.version]).toEqual(["subscription_list"]);
    expect(shared.areas.Older).toEqual(["retired_area"]);
    expect(shared.areas[discovery.version]).toEqual(discovery.areas);
    expect(shared.extensionTools).toEqual({ Helpers: ["first_helper"] });
    expect((await readFile(join(root, "plugins", "first", "gemini-extension.json"), "utf8"))).toContain(`@azure/mcp@${discovery.version}`);
    expect(await updatePlugins(root, discovery)).toEqual([]);
    const pinOnly = await updatePlugins(root, { ...discovery, version: "4.0.0-beta.5" });
    expect(pinOnly).toHaveLength(5);
    expect(pinOnly).not.toContain(sharedPath);
    expect(parseAllowlist(await readFile(sharedPath, "utf8")).commands)
      .not.toHaveProperty("4.0.0-beta.5");
    await expect(readFile(join(root, "allowed-tools.json"))).rejects.toThrow();
    await expect(readFile(join(root, "plugins", "allowed-tools.json"))).rejects.toThrow();
    for (const name of ["first", "second", "without-azure", "not-a-plugin"]) {
      await expect(readFile(join(root, "plugins", name, "allowed-tools.json"))).rejects.toThrow();
      await expect(readFile(join(root, "plugins", name, "allowed-azure-tools.json"))).rejects.toThrow();
    }
  });

  it("requires restoring a missing shared source without changing MCP pins", async () => {
    const root = await fixture();
    const path = join(root, "plugins", "allowed-azure-tools.json");
    await rm(path);
    const pin = join(root, "plugins", "first", ".mcp.json");
    const before = await readFile(pin, "utf8");
    await expect(updatePlugins(root, discovery)).rejects.toThrow("Restore it from source control");
    expect(await readFile(pin, "utf8")).toBe(before);
    await expect(readFile(path)).rejects.toThrow();
  });

  it("does not reseed an intentionally empty helper section in the shared source", async () => {
    const root = await fixture();
    const path = join(root, "plugins", "allowed-azure-tools.json");
    await writeFile(path, JSON.stringify(empty()));
    await updatePlugins(root, discovery);
    expect(parseAllowlist(await readFile(path, "utf8")).extensionTools).toEqual({});
  });

  it.each(["invalid allowlist", "invalid pin", "mismatched configurations"])("validates all files before writing: %s", async failure => {
    const root = await fixture();
    const path = join(root, "plugins", "allowed-azure-tools.json");
    const firstPin = join(root, "plugins", "first", ".mcp.json");
    const pinBefore = await readFile(firstPin, "utf8");
    if (failure === "invalid allowlist") {
      await writeFile(path, '{"commands":{}}');
    } else {
      await writeFile(join(root, "plugins", "second", ".mcp.json"), JSON.stringify({
        mcpServers: { azure: { command: "npx", args: failure === "invalid pin" ? ["@azure/mcp"] : ["@azure/mcp@1.0.0", "different"] } },
      }));
    }
    const before = await readFile(path, "utf8");
    await expect(updatePlugins(root, discovery)).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe(before);
    expect(await readFile(firstPin, "utf8")).toBe(pinBefore);
  });
});
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
