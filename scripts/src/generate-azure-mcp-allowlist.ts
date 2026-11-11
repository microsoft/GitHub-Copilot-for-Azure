import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

const execute = promisify(execFile);
const categories = ["commands", "areas", "extensionTools"] as const;
type Category = typeof categories[number];

/** Reporter-compatible tool categories grouped by descriptive first-seen labels. */
export type Allowlist = Record<Category, Record<string, string[]>>;

/** GitHub release metadata and assets needed to identify a published Azure MCP build. */
export interface Release {
  tag_name: string;
  draft: boolean;
  published_at: string | null;
  assets: { name: string; browser_download_url: string; digest: string | null }[];
}

/** Exact release identity and Linux x64 asset metadata passed between workflow steps. */
export interface ReleaseInfo {
  version: string;
  tag: string;
  url: string;
  digest: string | null;
}

/** Release discovery data keeping canonical commands separate from namespace-level tools. */
export interface Discovery {
  version: string;
  commands: string[];
  areas: string[];
}
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const assetName = "Azure.Mcp.Server-linux-x64.zip";
const telemetryEnvironment = {
  ...process.env,
  AZURE_MCP_TELEMETRY_OPTOUT: "true",
  DOTNET_CLI_TELEMETRY_OPTOUT: "true",
  AZURE_CORE_COLLECT_TELEMETRY: "0",
};

/** Requires an object-shaped input so malformed external data fails before field access. */
function object(value: unknown, description: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Validates tool-name arrays, rejecting blank names and empty groups unless explicitly allowed. */
function names(value: unknown, description: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) ||
      !value.every((name: unknown) => typeof name === "string" && name.trim().length > 0)) {
    throw new Error(`${description} must be ${allowEmpty ? "an" : "a non-empty"} array of non-blank strings.`);
  }
  return value as string[];
}

/** Validates the version format before using it as a release-group label or package pin. */
function version(value: unknown): string {
  if (typeof value !== "string" || !versionPattern.test(value)) {
    throw new Error(`Invalid Azure MCP release version: ${String(value)}`);
  }
  return value;
}

/**
 * Parses the reporter's grouped JSON contract, rejecting invalid or duplicate top-level sections.
 * Repeated group labels retain all their names rather than losing earlier values during JSON parsing.
 */
export function parseAllowlist(text: string): Allowlist {
  const parsed = object(JSON.parse(text.replace(/^\uFEFF/, "")), "Tool allowlist");
  // JSON.parse accepts duplicate properties. Scan structural tokens before trusting its result.
  const keys = new Set<string>();
  let depth = 0;
  let keyExpected = false;
  for (const token of text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]:,]/g)) {
    const value = token[0];
    if (depth === 1 && keyExpected && value.startsWith("\"")) {
      const key: string = JSON.parse(value);
      if (keys.has(key)) throw new Error(`Duplicate top-level section: ${key}`);
      keys.add(key);
      keyExpected = false;
    }
    if (value === "{" || value === "[") {
      depth++;
      if (depth === 1) keyExpected = true;
    } else if (value === "}" || value === "]") {
      depth--;
    } else if (value === "," && depth === 1) {
      keyExpected = true;
    }
  }
  if (keys.size !== categories.length || categories.some(category => !keys.has(category))) {
    throw new Error("Tool allowlist must contain exactly commands, areas, and extensionTools.");
  }
  const result: Allowlist = { commands: {}, areas: {}, extensionTools: {} };
  for (const category of categories) object(parsed[category], category);
  // The reporter unions repeated group labels too; do not let JSON.parse discard their earlier names.
  depth = 0;
  let section: Category = "commands";
  let label = "";
  let arrayStart = 0;
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]:,]/g)) {
    const token = match[0];
    if (token.startsWith("\"") && depth === 1) section = JSON.parse(token) as Category;
    if (token.startsWith("\"") && depth === 2) label = JSON.parse(token) as string;
    if (token === ":" && depth === 2) {
      arrayStart = match.index + 1;
      while (/\s/.test(text[arrayStart])) arrayStart++;
      if (text[arrayStart] !== "[") throw new Error(`${section}.${label} must be an array.`);
    }
    if (token === "]" && depth === 3) {
      const values = names(JSON.parse(text.slice(arrayStart, match.index + 1)), `${section}.${label}`);
      const groups = result[section];
      const previous = Object.hasOwn(groups, label) ? groups[label] : [];
      Object.defineProperty(groups, label, {
        value: [...previous, ...values], enumerable: true, configurable: true, writable: true,
      });
    }
    if (token === "{" || token === "[") depth++;
    else if (token === "}" || token === "]") depth--;
  }
  return result;
}

/** Validates and deduplicates discovery data, rejecting client prefixes and command/area overlap. */
export function parseDiscovery(value: unknown): Discovery {
  const data = object(value, "Discovery");
  const commands = names(data.commands, "Discovered commands");
  const areas = names(data.areas, "Discovered areas");
  for (const name of [...commands, ...areas]) {
    if (name !== name.trim() || /\s/.test(name) ||
        name.startsWith("azure-") || name.startsWith("mcp_azure_mcp_")) {
      throw new Error(`Discovery contains a non-canonical name: ${name}`);
    }
  }
  const commandSet = new Set(commands);
  if (areas.some(name => commandSet.has(name))) {
    throw new Error("Discovery contains a command in the areas category.");
  }
  return { version: version(data.version), commands: [...new Set(commands)].sort(), areas: [...new Set(areas)].sort() };
}

/**
 * Adds only previously unseen commands and areas to their release group without mutating existing history.
 * Existing extension helper groups remain unchanged.
 */
export function mergeAllowlist(existing: Allowlist, discovery: Discovery): Allowlist {
  const result = structuredClone(existing);
  for (const category of ["commands", "areas"] as const) {
    const groups = result[category];
    const known = new Set(Object.values(groups).flat());
    const additions = discovery[category].filter(name => !known.has(name));
    if (additions.length > 0) {
      const previous = Object.hasOwn(groups, discovery.version) ? groups[discovery.version] : [];
      Object.defineProperty(groups, discovery.version, {
        value: [...previous, ...additions].sort(), enumerable: true, configurable: true, writable: true,
      });
    }
  }
  return result;
}

/** Selects the newest published Azure MCP release, including prereleases, and requires its official Linux x64 asset. */
export function selectRelease(releases: Release[]): ReleaseInfo {
  const candidates = releases.filter(release =>
    !release.draft && release.published_at !== null && release.tag_name.startsWith("Azure.Mcp.Server-"));
  candidates.sort((a, b) => Date.parse(b.published_at!) - Date.parse(a.published_at!));
  const release = candidates[0];
  if (!release || !Number.isFinite(Date.parse(release.published_at!))) {
    throw new Error("No published Azure MCP release found.");
  }
  const releaseVersion = version(release.tag_name.slice("Azure.Mcp.Server-".length));
  const asset = release.assets.find(asset => asset.name === assetName);
  if (!asset || !asset.browser_download_url.startsWith("https://github.com/microsoft/mcp/releases/download/")) {
    throw new Error(`Release ${release.tag_name} has no official ${assetName} asset.`);
  }
  return { version: releaseVersion, tag: release.tag_name, url: asset.browser_download_url, digest: asset.digest ?? null };
}

/** Fetches JSON with a bounded request lifetime, optional authentication, and GitHub pagination detection. */
async function getJson(url: string, token?: string): Promise<{ data: unknown; next: boolean }> {
  const response = await fetch(url, {
    headers: {
      Accept: url.startsWith("https://api.github.com/") ? "application/vnd.github+json" : "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return { data: await response.json(), next: /rel="next"/.test(response.headers.get("link") ?? "") };
}

/** Validates the GitHub release and asset fields consumed by release selection, ignoring unrelated API fields. */
function parseRelease(value: unknown): Release {
  const release = object(value, "GitHub release");
  if (typeof release.tag_name !== "string" || typeof release.draft !== "boolean" ||
      !(release.published_at === null || typeof release.published_at === "string") || !Array.isArray(release.assets)) {
    throw new Error("Invalid GitHub release metadata.");
  }
  const assets = release.assets.map((value: unknown) => {
    const asset = object(value, "Release asset");
    if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string" ||
        !(asset.digest == null || typeof asset.digest === "string")) {
      throw new Error("Invalid GitHub release asset metadata.");
    }
    return { name: asset.name, browser_download_url: asset.browser_download_url, digest: asset.digest ?? null };
  });
  return { tag_name: release.tag_name, draft: release.draft, published_at: release.published_at, assets };
}

/** Pages the complete upstream release feed before selecting a release, refusing a truncated result. */
export async function resolveRelease(): Promise<ReleaseInfo> {
  const releases: Release[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await getJson(
      `https://api.github.com/repos/microsoft/mcp/releases?per_page=100&page=${page}`, process.env.GH_TOKEN,
    );
    if (!Array.isArray(response.data)) throw new Error("GitHub releases response is not an array.");
    releases.push(...response.data.map(parseRelease));
    if (!response.next) return selectRelease(releases);
  }
  throw new Error("Release pagination exceeded 100 pages; refusing incomplete release selection.");
}

/** Extracts sorted, unique command names from a successful `tools list --name-only` JSON response. */
export function parseCommandOutput(text: string): string[] {
  const response = object(JSON.parse(text), "Command response");
  if (response.status !== 200) throw new Error(`Tool listing failed: ${JSON.stringify(response)}`);
  const result = object(response.results, "Command results");
  return [...new Set(names(result.names, "Command names"))].sort();
}

/**
 * Initializes a namespace-mode MCP server and collects every page of exposed tool names.
 * Protocol failures, process errors, and timeouts reject discovery; the child is stopped before settling.
 *
 * @param prefixArgs Optional executable-wrapper arguments placed before the MCP CLI arguments.
 */
export async function listServerTools(binary: string, timeoutMs = 60_000, prefixArgs: string[] = []): Promise<string[]> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, [...prefixArgs, "server", "start", "--mode", "namespace"], {
      env: telemetryEnvironment, stdio: ["pipe", "pipe", "pipe"],
    });
    const lines = createInterface({ input: child.stdout });
    let stderr = "";
    let settled = false;
    let outcome: { names: string[] } | { error: Error } | undefined;
    let requestId = 1;
    let initialized = false;
    const collected: string[] = [];
    const cursors = new Set<string>();
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    /** Records the discovery outcome and starts child shutdown, escalating if graceful termination stalls. */
    const finish = (error?: Error) => {
      if (settled || outcome) return;
      outcome = error ? { error } : { names: [...new Set(collected)].sort() };
      clearTimeout(timer);
      child.stdin.end();
      child.kill();
      killTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
    };
    /** Writes one newline-delimited JSON-RPC message to the server's standard input. */
    const send = (payload: unknown) => child.stdin.write(`${JSON.stringify(payload)}\n`);
    const timer = setTimeout(() => finish(new Error("Timed out discovering Azure MCP server tools.")), timeoutMs);
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-4000); });
    child.stdin.on("error", error => finish(error));
    child.on("error", error => {
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      lines.close();
      reject(error);
    });
    child.on("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      lines.close();
      if (outcome && "names" in outcome) resolvePromise(outcome.names);
      else reject(new Error(`${outcome && "error" in outcome ? outcome.error.message : `Server exited before discovery (code ${code}).`}\n${stderr}`));
    });
    lines.on("line", line => {
      if (outcome || settled || !line.trim()) return;
      try {
        const message = object(JSON.parse(line), "JSON-RPC response");
        if (message.jsonrpc !== "2.0") throw new Error("Invalid JSON-RPC version.");
        if (!Object.hasOwn(message, "id")) return;
        if (message.id !== requestId) throw new Error("Unexpected JSON-RPC response ID.");
        if (message.error) throw new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`);
        const result = object(message.result, "JSON-RPC result");
        if (!initialized) {
          if (typeof result.protocolVersion !== "string") throw new Error("Missing MCP protocol version.");
          object(result.capabilities, "MCP capabilities");
          initialized = true;
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: ++requestId, method: "tools/list", params: {} });
          return;
        }
        if (!Array.isArray(result.tools)) throw new Error("Invalid MCP tools array.");
        const page = result.tools.map(tool => object(tool, "MCP tool").name);
        collected.push(...names(page, "MCP tool names", true));
        if (result.nextCursor !== undefined) {
          if (typeof result.nextCursor !== "string" || !result.nextCursor || cursors.has(result.nextCursor)) {
            throw new Error("Invalid or repeated MCP pagination cursor.");
          }
          cursors.add(result.nextCursor);
          send({ jsonrpc: "2.0", id: ++requestId, method: "tools/list", params: { cursor: result.nextCursor } });
        } else {
          if (collected.length === 0) throw new Error("Azure MCP returned no tools.");
          finish();
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
    send({
      jsonrpc: "2.0", id: requestId, method: "initialize",
      params: {
        protocolVersion: "2024-11-05", capabilities: {},
        clientInfo: { name: "ghcfa-allowlist-refresh", version: "1.0.0" },
      },
    });
  });
}

/**
 * Checks that the exact npm release is available and the executable matches that version,
 * then discovers commands separately from exposed namespace tools using the same binary.
 */
export async function discover(binary: string, releaseVersion: string): Promise<Discovery> {
  const expectedVersion = version(releaseVersion);
  const npm = await getJson(`https://registry.npmjs.org/@azure%2fmcp/${encodeURIComponent(expectedVersion)}`);
  if (object(npm.data, "npm version").version !== expectedVersion) throw new Error("Exact @azure/mcp version is unavailable.");
  const options = { encoding: "utf8" as const, timeout: 60_000, maxBuffer: 16 * 1024 * 1024, env: telemetryEnvironment };
  const actual = (await execute(binary, ["--version"], options)).stdout.trim();
  if (actual !== expectedVersion && !actual.startsWith(`${expectedVersion}+`)) {
    throw new Error(`Executable version ${actual} does not match ${expectedVersion}.`);
  }
  const commands = parseCommandOutput((await execute(binary, ["tools", "list", "--name-only"], options)).stdout);
  const commandSet = new Set(commands);
  const exposed = await listServerTools(binary);
  return parseDiscovery({ version: expectedVersion, commands, areas: exposed.filter(name => !commandSet.has(name)) });
}

/**
 * Replaces only the Azure server's pinned package argument while preserving surrounding JSON formatting.
 * Configurations without that server are unchanged; missing or ambiguous package pins are rejected.
 */
export function updatePin(text: string, releaseVersion: string): string {
  version(releaseVersion);
  const data = object(JSON.parse(text), "MCP configuration");
  const servers = object(data.mcpServers, "mcpServers");
  if (!Object.hasOwn(servers, "azure")) return text;
  const azure = object(servers.azure, "Azure MCP configuration");
  const args = names(azure.args, "Azure MCP args");
  const pins = args.filter(argument => argument.startsWith("@azure/mcp@"));
  if (pins.length !== 1) throw new Error("Expected exactly one pinned @azure/mcp argument.");
  const pin = pins[0];
  version(pin.slice("@azure/mcp@".length));
  // Replace only the Azure server's argument, even when another server uses the same package.
  const stack: { object: boolean; key?: string; keyExpected: boolean }[] = [];
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]:,]/g)) {
    const token = match[0];
    if (token === "{" || token === "[") {
      stack.push({ object: token === "{", keyExpected: token === "{" });
    } else if (token === "}" || token === "]") {
      stack.pop();
    } else if (token === "," && stack.at(-1)?.object) {
      stack[stack.length - 1].keyExpected = true;
    } else if (token.startsWith("\"")) {
      const current = stack.at(-1)!;
      if (current.object && current.keyExpected) {
        current.key = JSON.parse(token) as string;
        current.keyExpected = false;
      } else if (stack.length === 4 && stack[0].key === "mcpServers" &&
                 stack[1].key === "azure" && stack[2].key === "args" &&
                 !current.object && JSON.parse(token) === pin) {
        return text.slice(0, match.index) + JSON.stringify(`@azure/mcp@${releaseVersion}`) + text.slice(match.index + token.length);
      }
    }
  }
  throw new Error("Could not locate the Azure MCP package pin.");
}

/** Reads optional UTF-8 input, returning undefined only for a missing file and propagating other I/O failures. */
async function optionalRead(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Refreshes the single shared allowlist and existing plugin MCP pins, returning the changed file paths.
 * All proposed changes and portable/legacy configuration pairs are validated before the first write.
 */
export async function updatePlugins(root: string, rawDiscovery: unknown): Promise<string[]> {
  const discovery = parseDiscovery(rawDiscovery);
  const changes: { path: string; content: string }[] = [];
  const allowlistPath = join(root, "plugins", "allowed-azure-tools.json");
  const current = await optionalRead(allowlistPath);
  if (current === undefined) {
    throw new Error(`Missing shared tool allowlist '${allowlistPath}'. Restore it from source control to preserve extension helper history.`);
  }
  const existing = parseAllowlist(current);
  const content = `${JSON.stringify(mergeAllowlist(existing, discovery), null, 2)}\n`;
  if (current !== content) changes.push({ path: allowlistPath, content });
  const directories = await readdir(join(root, "plugins"), { withFileTypes: true });
  let pluginCount = 0;
  for (const directory of directories.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!directory.isDirectory()) continue;
    const plugin = join(root, "plugins", directory.name);
    if (await optionalRead(join(plugin, "plugin.json")) === undefined) continue;
    pluginCount++;
    const configurations = new Map<string, Record<string, unknown>>();
    for (const file of ["mcp.json", ".mcp.json", "gemini-extension.json"]) {
      const path = join(plugin, file);
      const before = await optionalRead(path);
      if (before === undefined) {
        if (file !== "gemini-extension.json") throw new Error(`Missing plugin MCP configuration: ${path}`);
        continue;
      }
      const after = updatePin(before, discovery.version);
      configurations.set(file, object(object(JSON.parse(after), file).mcpServers, `${file} servers`));
      if (before !== after) changes.push({ path, content: after });
    }
    const legacy = configurations.get(".mcp.json")!;
    const normalized = Object.fromEntries(Object.entries(legacy).map(([name, value]) => {
      const server = object(value, `Legacy server ${name}`);
      const type = server.type === "http" ? "streamable-http" : server.type ?? ("command" in server ? "stdio" : undefined);
      return [name, { ...server, type }];
    }));
    if (!isDeepStrictEqual(configurations.get("mcp.json"), normalized)) {
      throw new Error(`Portable and legacy MCP configurations differ for ${directory.name}.`);
    }
  }
  if (pluginCount === 0) throw new Error("No plugin packages found.");
  // Complete validation across every plugin before the first write.
  for (const change of changes) await writeFile(change.path, change.content, "utf8");
  return changes.map(change => change.path);
}

/** Parses the refresh command and option/value pairs, rejecting unknown commands and malformed or repeated options. */
function argumentsFor(argv: string[]): { command: string; options: Map<string, string> } {
  const [command, ...args] = argv;
  if (!["resolve", "discover", "update", "verify-asset"].includes(command)) {
    throw new Error("Usage: generateAzureMcpAllowlist <resolve|discover|update|verify-asset> --<option> <value>");
  }
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key.startsWith("--") || !value || value.startsWith("--") || options.has(key)) {
      throw new Error(`Invalid or duplicate option: ${key}`);
    }
    options.set(key, value);
  }
  return { command, options };
}

/** Dispatches the CLI's release resolution, asset verification, discovery, or shared-source and pin updates. */
async function main(): Promise<void> {
  const { command, options } = argumentsFor(process.argv.slice(2));
  const allowed: Record<string, string[]> = {
    resolve: ["--output"],
    discover: ["--binary", "--release", "--output"],
    update: ["--discovery", "--root"],
    "verify-asset": ["--release", "--archive"],
  };
  if ([...options.keys()].some(key => !allowed[command].includes(key))) throw new Error("Unknown option.");
  /** Retrieves a required option value instead of allowing an incomplete CLI invocation to proceed. */
  const get = (key: string) => {
    const value = options.get(key);
    if (!value) throw new Error(`Missing option ${key}`);
    return value;
  };
  if (command === "update") {
    const changes = await updatePlugins(resolve(get("--root")), JSON.parse(await readFile(get("--discovery"), "utf8")));
    console.log(`Updated ${changes.length} files.`);
    return;
  }
  if (command === "verify-asset") {
    const release = object(JSON.parse(await readFile(get("--release"), "utf8")), "Release metadata");
    const archive = await readFile(get("--archive"));
    if (release.digest === null) {
      console.log("Release API supplies no asset digest; using the official release asset without digest verification.");
      return;
    }
    if (typeof release.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(release.digest)) throw new Error("Invalid asset digest.");
    const actual = createHash("sha256").update(archive).digest("hex");
    if (`sha256:${actual}` !== release.digest) throw new Error("Release asset digest mismatch.");
    return;
  }
  const output = command === "resolve"
    ? await resolveRelease()
    : await discover(resolve(get("--binary")), version(object(JSON.parse(await readFile(get("--release"), "utf8")), "Release metadata").version));
  await writeFile(get("--output"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
