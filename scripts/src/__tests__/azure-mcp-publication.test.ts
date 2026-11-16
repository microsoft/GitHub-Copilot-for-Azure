import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import matter from "gray-matter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { branch, prBody, publish, type PublicationIO } from "../azure-mcp-publication.js";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const template = readFileSync(join(root, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8");
const discovery = { version: "4.0.0-beta.4", commands: ["subscription_list"], areas: ["storage"] };
const sha = "a".repeat(40);
const execute = promisify(execFile);
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

function fixture(existing = false): PublicationIO {
  let committed = false;
  return {
    root, template,
    git: vi.fn(async (...args: string[]) => {
      if (args[0] === "rev-parse") return args[1] === "HEAD" && committed ? "b".repeat(40) : sha;
      if (args[0] === "ls-remote") return existing ? `${sha}\trefs/heads/${branch}` : "";
      if (args[0] === "log") return "github-actions[bot]";
      if (args[0] === "diff") return existing || committed ? "plugins/allowed-azure-tools.json" : "";
      if (args[0] === "commit") committed = true;
      return "";
    }),
    request: vi.fn(async (method: string) => method === "GET"
      ? existing ? [{ number: 42, body: "<!-- azure-mcp-allowlist-refresh -->" }] : []
      : {}),
    update: vi.fn(async () => [join(root, "plugins", "allowed-azure-tools.json")]),
  };
}

describe("refresh publication", () => {
  it("preserves template headings, comments, checklist and ordering", () => {
    const body = prBody(template, discovery);
    const lines = template.split("\n").filter(line => line.startsWith("##") || line.startsWith("<!--") || line.startsWith("- ["));
    for (const line of lines) expect(body).toContain(line);
    expect(body.indexOf("## Description")).toBeLessThan(body.indexOf("## Checklist"));
    expect(body.indexOf("## Checklist")).toBeLessThan(body.indexOf("## Related Issues"));
    expect(body).toContain("Validation passed");
    expect(body).toContain("were not run");
    expect(body).toContain("Relates to microsoft/GitHub-Copilot-for-Azure#3452");
    expect(body).not.toContain("Fixes #3452");
    expect(body).toContain("`plugins/allowed-azure-tools.json`");
    expect(body).toContain("Copying it into built plugins is left to a separate build change.");
    expect(body).not.toContain("identical copies");
    expect(body).not.toContain("independently");
  });

  it("does not commit, push or create a PR on an unchanged result", async () => {
    const io = fixture();
    io.update = vi.fn(async () => []);
    expect(await publish(discovery, io)).toContain("No Azure MCP");
    expect(vi.mocked(io.git).mock.calls.some(([command]) => ["commit", "push"].includes(command))).toBe(false);
    expect(vi.mocked(io.request).mock.calls.map(([method]) => method)).toEqual(["GET"]);
  });

  it.each([false, true])("publishes only allowed files and creates/updates one PR (existing=%s)", async existing => {
    const io = fixture(existing);
    expect(await publish(discovery, io)).toContain("Published");
    expect(io.git).toHaveBeenCalledWith("add", "--", "plugins/allowed-azure-tools.json");
    expect(io.git).toHaveBeenCalledWith("push", `--force-with-lease=refs/heads/${branch}:${existing ? sha : ""}`, "origin", `HEAD:refs/heads/${branch}`);
    expect(io.request).toHaveBeenCalledWith(existing ? "PATCH" : "POST", existing ? "/pulls/42" : "/pulls", expect.objectContaining({
      base: "main", head: branch, title: expect.stringMatching(/^chore:/), body: expect.stringContaining("Validation passed"),
    }));
  });

  it("allows pin-only updates without staging the unchanged shared source", async () => {
    const io = fixture();
    io.update = vi.fn(async () => [
      join(root, "plugins", "azure-skills", ".mcp.json"),
      join(root, "plugins", "azure-skills", "mcp.json"),
      join(root, "plugins", "azure-skills", "gemini-extension.json"),
    ]);
    await publish(discovery, io);
    expect(io.git).toHaveBeenCalledWith("add", "--",
      "plugins/azure-skills/.mcp.json", "plugins/azure-skills/mcp.json", "plugins/azure-skills/gemini-extension.json");
  });

  it("configures the bot identity before rebasing pending commits", async () => {
    const io = fixture(true);
    await publish(discovery, io);
    const calls = vi.mocked(io.git).mock.calls;
    const rebase = calls.findIndex(([command]) => command === "rebase");
    expect(rebase).toBeGreaterThan(-1);
    for (const setting of ["user.name", "user.email"]) {
      const configured = calls.findIndex(([command, key]) => command === "config" && key === setting);
      expect(configured).toBeGreaterThan(-1);
      expect(configured).toBeLessThan(rebase);
    }
  });

  it("does not commit, push or update an already-current open PR", async () => {
    const io = fixture(true);
    io.update = vi.fn(async () => []);
    expect(await publish(discovery, io)).toContain("already contains");
    expect(vi.mocked(io.git).mock.calls.some(([command]) => ["commit", "push"].includes(command))).toBe(false);
    expect(vi.mocked(io.request).mock.calls.map(([method]) => method)).toEqual(["GET"]);
  });

  it("creates a missing PR for an already-pushed refresh without another commit or push", async () => {
    const io = fixture(true);
    io.update = vi.fn(async () => []);
    io.request = vi.fn(async (method: string) => method === "GET" ? [] : {});
    expect(await publish(discovery, io)).toContain("Published");
    expect(vi.mocked(io.git).mock.calls.some(([command]) => ["add", "commit", "push"].includes(command))).toBe(false);
    expect(io.request).toHaveBeenLastCalledWith("POST", "/pulls", expect.objectContaining({ base: "main", head: branch }));
  });

  it("does not publish an existing automation branch with no changes relative to main", async () => {
    const io = fixture(true);
    io.update = vi.fn(async () => []);
    io.request = vi.fn(async (method: string) => method === "GET" ? [] : {});
    const original = io.git;
    io.git = vi.fn((...args) => args[0] === "diff" ? Promise.resolve("") : original(...args));
    expect(await publish(discovery, io)).toContain("No Azure MCP");
    expect(vi.mocked(io.git).mock.calls.some(([command]) => ["commit", "push"].includes(command))).toBe(false);
    expect(vi.mocked(io.request).mock.calls.map(([method]) => method)).toEqual(["GET"]);
  });

  it("pushes rebased pending changes even when generation has nothing new to commit", async () => {
    const io = fixture(true);
    io.update = vi.fn(async () => []);
    const original = io.git;
    let headReads = 0;
    io.git = vi.fn((...args) => {
      if (args[0] === "rev-parse" && args[1] === "HEAD" && ++headReads > 1) return Promise.resolve("b".repeat(40));
      return original(...args);
    });
    expect(await publish(discovery, io)).toContain("Published");
    expect(vi.mocked(io.git).mock.calls.some(([command]) => ["add", "commit"].includes(command))).toBe(false);
    expect(io.git).toHaveBeenCalledWith("push", `--force-with-lease=refs/heads/${branch}:${sha}`, "origin", `HEAD:refs/heads/${branch}`);
    expect(io.request).toHaveBeenLastCalledWith("PATCH", "/pulls/42", expect.any(Object));
  });

  it.each(["config", "add", "commit", "push", "fetch", "rebase"])("propagates git %s failures", async command => {
    const io = fixture(true);
    const original = io.git;
    io.git = vi.fn((...args) => args[0] === command ? Promise.reject(new Error(`${command} failed`)) : original(...args));
    await expect(publish(discovery, io)).rejects.toThrow(`${command} failed`);
    expect(vi.mocked(io.request).mock.calls.some(([method]) => method !== "GET")).toBe(false);
  });

  it.each(["GET", "POST", "PATCH"])("propagates GitHub %s failures", async method => {
    const io = fixture(method === "PATCH");
    const original = io.request;
    io.request = vi.fn((verb, path, body) => verb === method ? Promise.reject(new Error("API failed")) : original(verb, path, body));
    await expect(publish(discovery, io)).rejects.toThrow("API failed");
  });

  it("refuses out-of-scope paths and unrelated PRs", async () => {
    const io = fixture();
    io.update = vi.fn(async () => [join(root, "unrelated.txt")]);
    await expect(publish(discovery, io)).rejects.toThrow("outside");
    io.request = vi.fn(async () => [{ number: 42, body: "human PR" }]);
    await expect(publish(discovery, io)).rejects.toThrow("unrelated PR");
  });

  it.each([
    ["plugins", "azure-skills", "allowed-tools.json"],
    ["plugins", "allowed-tools.json"],
    ["plugins", "azure-skills", "allowed-azure-tools.json"],
  ])("rejects obsolete or plugin-local allowlist output: %j", (...path) => {
    const io = fixture();
    io.update = vi.fn(async () => [join(root, ...path)]);
    return expect(publish(discovery, io)).rejects.toThrow("outside");
  });

  it("refuses concurrent branch changes and non-bot commits", async () => {
    for (const failure of ["race", "author"]) {
      const io = fixture(true);
      const original = io.git;
      io.git = vi.fn((...args) => {
        if (failure === "race" && args[1] === "FETCH_HEAD") return Promise.resolve("b".repeat(40));
        if (failure === "author" && args[0] === "log") return Promise.resolve("Contributor");
        return original(...args);
      });
      await expect(publish(discovery, io)).rejects.toThrow(failure === "race" ? "changed during" : "non-bot");
      expect(vi.mocked(io.git).mock.calls.some(([command]) => command === "push")).toBe(false);
    }
  });

  it("recovers a failed PR creation and rebases pending releases with an isolated Git identity", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "azure-mcp-publication-"));
    temporary.push(workspace);
    const remote = join(workspace, "origin.git");
    const checkout = join(workspace, "checkout");
    await mkdir(checkout);
    const environment = {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: join(workspace, "gitconfig"),
      GIT_AUTHOR_NAME: undefined, GIT_AUTHOR_EMAIL: undefined,
      GIT_COMMITTER_NAME: undefined, GIT_COMMITTER_EMAIL: undefined,
      GIT_CONFIG_COUNT: "3",
      GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false",
      GIT_CONFIG_KEY_1: "core.autocrlf", GIT_CONFIG_VALUE_1: "false",
      GIT_CONFIG_KEY_2: "user.useConfigOnly", GIT_CONFIG_VALUE_2: "true",
    };
    const git = async (...args: string[]) =>
      (await execute("git", args, { cwd: checkout, env: environment, encoding: "utf8" })).stdout;
    await git("init", "--bare", remote);
    await git("init", "--initial-branch=main");
    await git("config", "user.name", "Test");
    await git("config", "user.email", "test@example.invalid");
    await writeFile(join(checkout, "baseline.txt"), "baseline\n");
    await git("add", ".");
    await git("commit", "-m", "Baseline");
    await git("remote", "add", "origin", remote);
    await git("push", "origin", "main");
    const path = join(checkout, "plugins", "allowed-azure-tools.json");
    const request = vi.fn(async (method: string) => {
      if (method === "GET") return [];
      throw new Error("PR creation failed");
    });
    await expect(publish(discovery, {
      git, request, root: checkout, template,
      update: async () => {
        await mkdir(join(checkout, "plugins"), { recursive: true });
        await writeFile(path, JSON.stringify({ commands: { Initial: discovery.commands }, areas: { Initial: discovery.areas }, extensionTools: {} }));
        await writeFile(join(checkout, "unrelated.txt"), "Do not stage\n");
        return [path];
      },
    })).rejects.toThrow("PR creation failed");
    expect((await git("show", "--format=", "--name-only", "HEAD")).trim()).toBe("plugins/allowed-azure-tools.json");
    expect((await git("status", "--short")).trim()).toBe("?? unrelated.txt");
    expect((await git("ls-remote", "--heads", "origin", branch)).trim()).toContain(`refs/heads/${branch}`);
    expect(await git("log", "-1", "--format=%B")).toContain("Co-authored-by: Copilot App");
    expect(request).toHaveBeenLastCalledWith("POST", "/pulls", expect.any(Object));

    const publishedHead = (await git("rev-parse", "HEAD")).trim();
    const retryCheckout = join(workspace, "retry-checkout");
    await git("clone", "--branch", "main", remote, retryCheckout);
    const retryGit = vi.fn(async (...args: string[]) =>
      (await execute("git", args, { cwd: retryCheckout, env: environment, encoding: "utf8" })).stdout);
    const retryRequest = vi.fn(async (method: string) => method === "GET" ? [] : {});
    expect(await publish(discovery, {
      git: retryGit, request: retryRequest, root: retryCheckout, template,
      update: async () => [],
    })).toContain("Published");
    expect((await retryGit("rev-parse", "HEAD")).trim()).toBe(publishedHead);
    expect(retryGit.mock.calls.some(([command]) => ["commit", "push"].includes(command))).toBe(false);
    expect(retryRequest).toHaveBeenLastCalledWith("POST", "/pulls", expect.any(Object));

    await git("checkout", "main");
    await writeFile(join(checkout, "baseline.txt"), "Main advanced\n");
    await git("add", "baseline.txt");
    await git("commit", "-m", "Advance main");
    await git("push", "origin", "main");
    const advancedMain = (await git("rev-parse", "HEAD")).trim();
    const nextCheckout = join(workspace, "next-checkout");
    await git("clone", "--branch", "main", remote, nextCheckout);
    const nextGit = async (...args: string[]) =>
      (await execute("git", args, { cwd: nextCheckout, env: environment, encoding: "utf8" })).stdout;
    await expect(nextGit("var", "GIT_COMMITTER_IDENT")).rejects.toThrow();
    const nextPath = join(nextCheckout, "plugins", "allowed-azure-tools.json");
    const nextRequest = vi.fn(async (method: string) => method === "GET"
      ? [{ number: 42, body: "<!-- azure-mcp-allowlist-refresh -->" }]
      : {});
    await publish({ ...discovery, version: "4.0.0-beta.5", commands: ["new_tool"] }, {
      git: nextGit, request: nextRequest, root: nextCheckout, template,
      update: async () => {
        const previous = await readFile(nextPath, "utf8");
        expect(previous).toContain("subscription_list");
        const parsed: { commands: Record<string, string[]> } = JSON.parse(previous);
        parsed.commands["4.0.0-beta.5"] = ["new_tool"];
        await writeFile(nextPath, JSON.stringify(parsed));
        return [nextPath];
      },
    });
    expect(await readFile(nextPath, "utf8")).toContain("subscription_list");
    expect(await readFile(nextPath, "utf8")).toContain("new_tool");
    await nextGit("merge-base", "--is-ancestor", advancedMain, "HEAD");
    expect((await nextGit("log", "--format=%cn", `${advancedMain}..HEAD`)).trim().split("\n"))
      .toEqual(["github-actions[bot]", "github-actions[bot]"]);
    expect(nextRequest).toHaveBeenLastCalledWith("PATCH", "/pulls/42", expect.any(Object));
  }, 45_000);
});

interface Step { name: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown> }
interface Workflow {
  on: { schedule: { cron: string }[]; workflow_dispatch: null };
  permissions: Record<string, string>;
  concurrency: { group: string };
  jobs: Record<string, { if: string; needs?: string; steps: Step[] }>;
}

describe("refresh workflow", () => {
  const workflow = matter(`---\n${readFileSync(join(root, ".github", "workflows", "refresh-azure-mcp-allowlist.yml"), "utf8")}\n---`).data as Workflow;
  it("is daily/manual, upstream-only, and separates release execution from publication", () => {
    expect(workflow.on.schedule).toEqual([{ cron: "43 5 * * *" }]);
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency.group).toBe("refresh-azure-mcp-allowlists");
    expect(workflow.jobs.publish.needs).toBe("discover");
    for (const job of Object.values(workflow.jobs)) {
      expect(job.if).toBe("github.repository == 'microsoft/GitHub-Copilot-for-Azure'");
      for (const step of job.steps) {
        if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
        if (step.run) {
          const result = spawnSync("bash", ["-n"], { input: step.run, encoding: "utf8" });
          expect(result.status, result.stderr).toBe(0);
        }
      }
    }
    expect(JSON.stringify(workflow.jobs.discover)).not.toContain("secrets.");
    expect(workflow.jobs.discover.steps.find(step => step.name === "Discover commands and namespace tools")?.env?.GH_TOKEN).toBeUndefined();
    const bot = workflow.jobs.publish.steps.find(step => step.name === "Generate publication token");
    expect(bot?.with).toMatchObject({ "permission-contents": "write", "permission-pull-requests": "write" });
    expect(workflow.jobs.publish.steps.find(step => step.name === "Checkout current main")?.with)
      .toMatchObject({ ref: "main", "fetch-depth": 0, "persist-credentials": false });
    expect(workflow.jobs.publish.steps.some(step => step.run?.includes("azmcp"))).toBe(false);
  });
});
