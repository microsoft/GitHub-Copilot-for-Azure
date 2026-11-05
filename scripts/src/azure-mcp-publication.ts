import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseDiscovery, updatePlugins, type Discovery } from "./generate-azure-mcp-allowlist.js";

const execute = promisify(execFile);

/** Dedicated branch reused by automated Azure MCP allowlist refresh pull requests. */
export const branch = "automation/azure-mcp-allowlists";
const repository = "microsoft/GitHub-Copilot-for-Azure";
const allowedPath = /^plugins\/(?:allowed-azure-tools\.json|[^/]+\/(?:\.?mcp\.json|gemini-extension\.json))$/;
type PullRequest = { number: number; body: string | null };

/** Injectable Git, GitHub API, generator, and repository inputs used to orchestrate and test publication. */
export interface PublicationIO {
  /** Runs Git in the publication checkout and returns its standard output. */
  git: (...args: string[]) => Promise<string>;
  /** Sends a repository-relative GitHub REST request and returns its parsed JSON response. */
  request: (method: string, path: string, body?: unknown) => Promise<unknown>;
  /** Refreshes the shared source and existing MCP pins, returning the changed file paths. */
  update: () => Promise<string[]>;
  /** Repository PR template whose headings, comments, and checklist must be retained. */
  template: string;
  /** Repository root used to constrain changed paths to the publication scope. */
  root: string;
}

/** Checks the PR number and body fields needed to identify an existing refresh pull request. */
function isPullRequest(value: unknown): value is PullRequest {
  return typeof value === "object" && value !== null &&
    "number" in value && typeof value.number === "number" &&
    "body" in value && (typeof value.body === "string" || value.body === null);
}

/** Inserts release details and workflow validation results into the repository's existing PR template. */
export function prBody(template: string, discovery: Discovery): string {
  const marker = "<!-- azure-mcp-allowlist-refresh -->";
  const summary = [
    marker,
    "",
    `Azure MCP tool coverage and client package pins can drift from published releases. This PR refreshes the cumulative \`plugins/allowed-azure-tools.json\` source and existing plugin Azure MCP pins from [Azure.Mcp.Server-${discovery.version}](https://github.com/microsoft/mcp/releases/tag/Azure.Mcp.Server-${discovery.version}).`,
    "",
    `Discovery contains ${discovery.commands.length} commands and ${discovery.areas.length} namespace tools. Only newly seen names are added to release groups; historical groups and extension helpers are preserved in the single shared source file. Copying it into built plugins is left to a separate build change.`,
    "",
    "Validation passed:",
    "- `cd scripts && npm test -- src/__tests__/generate-azure-mcp-allowlist.test.ts src/__tests__/azure-mcp-publication.test.ts` (passed)",
    "- `cd scripts && npm run typecheck` (passed)",
    "- `cd scripts && npm run lint -- src/generate-azure-mcp-allowlist.ts src/azure-mcp-publication.ts src/__tests__/generate-azure-mcp-allowlist.test.ts src/__tests__/azure-mcp-publication.test.ts` (passed)",
    "",
    "The plugin build, `cd tests && npm test`, and skill routing tests were not run by this workflow. No skill descriptions, build packaging, or telemetry hook wiring are changed.",
  ].join("\n");
  if (!template.includes("## Description") || !template.includes("## Related Issues")) {
    throw new Error("PR template headings changed; update the refresh PR renderer.");
  }
  return template
    .replace("## Description", `## Description\n\n${summary}`)
    .replace("## Related Issues", "## Related Issues\n\nRelates to microsoft/GitHub-Copilot-for-Azure#3452");
}

/**
 * Refreshes a clean checkout, retains pending release history, and publishes one scoped bot-managed PR.
 * Recovers missing PRs without requiring new generated changes, rejecting unrelated or concurrently changed work.
 */
export async function publish(discovery: Discovery, io: PublicationIO): Promise<string> {
  const { git, request } = io;
  if ((await git("status", "--porcelain")).trim()) throw new Error("Publication checkout must be clean.");
  const base = (await git("rev-parse", "HEAD")).trim();
  const remote = (await git("ls-remote", "--heads", "origin", `refs/heads/${branch}`)).trim();
  const expected = remote ? remote.split(/\s/)[0] : "";
  if (expected && !/^[a-f0-9]{40}$/.test(expected)) throw new Error("Invalid automation branch SHA.");
  const prs = await request("GET", `/pulls?state=open&base=main&head=microsoft:${branch}&per_page=100`);
  if (!Array.isArray(prs) || !prs.every(isPullRequest) || prs.length > 1) throw new Error("Unexpected refresh PR response.");
  if (prs[0] && !prs[0].body?.includes("<!-- azure-mcp-allowlist-refresh -->")) {
    throw new Error("Refusing to overwrite an unrelated PR on the automation branch.");
  }
  await git("config", "user.name", "github-actions[bot]");
  await git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  if (expected) {
    await git("fetch", "--no-tags", "origin", `refs/heads/${branch}`);
    const fetched = (await git("rev-parse", "FETCH_HEAD")).trim();
    if (fetched !== expected) throw new Error("Automation branch changed during refresh; rerun.");
    const authors = (await git("log", "--format=%an", `${base}..${expected}`)).trim().split("\n").filter(Boolean);
    if (authors.some(author => author !== "github-actions[bot]")) {
      throw new Error("Automation branch has a non-bot commit; review it before rerunning.");
    }
    await git("checkout", "-b", branch, expected);
    // Keep unmerged release groups when a newer release arrives before the previous PR merges.
    await git("rebase", base);
    const pending = (await git("diff", "--name-only", `${base}...HEAD`)).trim().split("\n").filter(Boolean);
    if (pending.some(path => !allowedPath.test(path))) throw new Error("Automation branch contains out-of-scope changes.");
  } else {
    await git("checkout", "-b", branch);
  }
  const changed = await io.update();
  const paths = changed.map(path => relative(io.root, path).replaceAll("\\", "/"));
  if (paths.some(path => !allowedPath.test(path))) {
    throw new Error("Generator returned a path outside the allowed publication scope.");
  }
  const title = `chore: refresh Azure MCP allowlists to ${discovery.version}`;
  if (paths.length > 0) {
    await git("add", "--", ...paths);
    await git("commit", "-m", `${title}\n\nCo-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`);
  }
  const pending = (await git("diff", "--name-only", `${base}...HEAD`)).trim().split("\n").filter(Boolean);
  if (pending.length === 0) return "No Azure MCP allowlist or pin changes.";
  const head = (await git("rev-parse", "HEAD")).trim();
  if (head === expected && prs.length > 0) return "Existing refresh PR already contains these changes.";
  const body = prBody(io.template, discovery);
  if (head !== expected) {
    await git("push", `--force-with-lease=refs/heads/${branch}:${expected}`, "origin", `HEAD:refs/heads/${branch}`);
  }
  const payload = { title, body, base: "main", head: branch };
  if (prs.length) await request("PATCH", `/pulls/${prs[0].number}`, payload);
  else await request("POST", "/pulls", payload);
  return `Published Azure MCP ${discovery.version} refresh (${pending.length} files).`;
}

/** Runs upstream-only publication using the workflow's Git credentials and GitHub API token. */
async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path || process.argv.length !== 3) throw new Error("Usage: azure-mcp-publication.ts <discovery.json>");
  if (process.env.GITHUB_REPOSITORY !== repository) throw new Error("Publication is restricted to the upstream repository.");
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required for publication.");
  const root = process.cwd();
  const discovery = parseDiscovery(JSON.parse(await readFile(path, "utf8")));
  const result = await publish(discovery, {
    root,
    template: await readFile(resolve(root, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8"),
    update: () => updatePlugins(root, discovery),
    git: async (...args) => (await execute("git", args, { cwd: root, encoding: "utf8", timeout: 60_000 })).stdout,
    request: async (method, path, body) => {
      const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${await response.text()}`);
      return response.json();
    },
  });
  console.log(result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
