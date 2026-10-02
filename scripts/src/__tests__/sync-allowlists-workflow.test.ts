import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";

interface Destination {
  repository: string;
  "resource-directory": string;
  branch: string;
  "pr-title": string;
}

interface Step {
  name: string;
  uses?: string;
  run?: string;
  if?: string;
  "working-directory"?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface Workflow {
  on: { schedule: { cron: string }[]; workflow_dispatch: null };
  permissions: Record<string, string>;
  jobs: Record<string, {
    if: string;
    needs?: string;
    env?: Record<string, string>;
    strategy?: { "fail-fast": boolean; matrix: { include: Destination[] } };
    steps: Step[];
  }>;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const workflow = matter(
  `---\n${readFileSync(join(REPO_ROOT, ".github", "workflows", "sync-to-azure-mcp.yml"), "utf8")}\n---\n`,
).data as Workflow;
const generation = workflow.jobs["generate-allowlists"];
const publication = workflow.jobs["sync-allowlists"];
const destinations = publication.strategy!.matrix.include;
const files = ["allowed-skill-names.json", "allowed-plugin-file-references.json"];
const temporaryRoots: string[] = [];
const gitEnvironment = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "commit.gpgsign",
  GIT_CONFIG_VALUE_0: "false",
  GIT_CONFIG_KEY_1: "core.autocrlf",
  GIT_CONFIG_VALUE_1: "false",
};

const mockCommands = `
GH_CALLS="$PWD/$GH_CALLS"
GIT_CALLS="$PWD/$GIT_CALLS"
GITHUB_OUTPUT="$PWD/$GITHUB_OUTPUT"
gh() {
  printf '%s\\n' '---' "$@" >> "$GH_CALLS"
  case "$1 $2" in
    "repo clone") command git clone "$REMOTE_REPO" "$4" --branch main --single-branch ;;
    "auth setup-git") return 0 ;;
    "pr list")
      if [ "\${FAIL_PR_LIST:-0}" != 0 ]; then return 23; fi
      printf '%s\\n' "$EXISTING_PR"
      ;;
    "pr create"|"pr edit") return "\${PR_EXIT_CODE:-0}" ;;
    *) echo "Unexpected gh command: $*" >&2; return 99 ;;
  esac
}
git() {
  printf '%s\\n' '---' "$@" >> "$GIT_CALLS"
  if [ "$1" = "\${FAIL_GIT_COMMAND:-}" ]; then return 23; fi
  if [ "$1" = push ]; then return 0; fi
  command git "$@"
}
`;

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, env: gitEnvironment, encoding: "utf8" });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function getStep(steps: Step[], name: string): Step {
  const step = steps.find(candidate => candidate.name === name);
  if (!step) {
    throw new Error(`Workflow step not found: ${name}`);
  }
  return step;
}

function fixture(destination: Destination, changed = true) {
  const root = mkdtempSync(join(tmpdir(), "allowlist sync-"));
  temporaryRoots.push(root);
  const remote = join(root, "remote");
  const workspace = join(root, "workspace");
  const resources = join(remote, ...destination["resource-directory"].split("/"));
  mkdirSync(resources, { recursive: true });
  mkdirSync(join(workspace, "generated-allowlists"), { recursive: true });
  for (const file of files) {
    writeFileSync(join(resources, file), changed ? "{}\n" : `{"updated":"${file}"}\n`);
    writeFileSync(join(workspace, "generated-allowlists", file), `{"updated":"${file}"}\n`);
  }
  writeFileSync(join(resources, "allowed-tool-names.json"), '{"pinned":true}\n');
  writeFileSync(join(remote, "unrelated.txt"), "untouched\n");
  git(remote, "init", "--initial-branch=main");
  git(remote, "config", "user.name", "Test");
  git(remote, "config", "user.email", "test@example.invalid");
  git(remote, "add", ".");
  git(remote, "commit", "-m", "Baseline");
  return { workspace, target: join(workspace, "target-repo"), destination };
}

type Fixture = ReturnType<typeof fixture>;

function runStep(context: Fixture, name: string, overrides: NodeJS.ProcessEnv = {}) {
  const step = getStep(publication.steps, name);
  if (!step.run) {
    throw new Error(`Workflow step has no shell script: ${name}`);
  }
  const inTarget = step["working-directory"] === "target-repo";
  return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail"], {
    cwd: inTarget ? context.target : context.workspace,
    encoding: "utf8",
    input: `${mockCommands}\n${step.run}`,
    env: {
      ...gitEnvironment,
      TARGET_REPO: `microsoft/${context.destination.repository}`,
      RESOURCE_DIR: context.destination["resource-directory"],
      BRANCH_NAME: context.destination.branch,
      PR_TITLE: context.destination["pr-title"],
      SOURCE_URL: "https://github.com/microsoft/GitHub-Copilot-for-Azure",
      SOURCE_COMMIT: "a".repeat(40),
      REMOTE_REPO: "../remote",
      GH_CALLS: inTarget ? "../gh-calls.txt" : "gh-calls.txt",
      GIT_CALLS: inTarget ? "../git-calls.txt" : "git-calls.txt",
      GITHUB_OUTPUT: inTarget ? "../workflow-output.txt" : "workflow-output.txt",
      EXISTING_PR: "",
      ...overrides,
    },
  });
}

function succeed(context: Fixture, name: string) {
  const result = runStep(context, name);
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}

function readCalls(workspace: string, file: string): string[][] {
  return readFileSync(join(workspace, file), "utf8")
    .split("---\n")
    .slice(1)
    .map(call => call.trimEnd().split("\n"));
}

function prepare(context: Fixture): void {
  succeed(context, "Clone target repo and create feature branch");
  succeed(context, "Copy JSON files to target repo");
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("allowlist synchronization workflow", () => {
  it("shares one generated snapshot between independently failing upstream-only destinations", () => {
    expect(workflow.on.schedule).toEqual([{ cron: "0 11 * * 1-5" }]);
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(generation.if).toBe("github.repository == 'microsoft/GitHub-Copilot-for-Azure'");
    expect(publication.if).toBe(generation.if);
    expect(publication.needs).toBe("generate-allowlists");
    expect(publication.strategy!["fail-fast"]).toBe(false);
    expect(publication.env).toEqual({
      TARGET_REPO: "microsoft/${{ matrix.repository }}",
      RESOURCE_DIR: "${{ matrix.resource-directory }}",
      BRANCH_NAME: "${{ matrix.branch }}",
      PR_TITLE: "${{ matrix.pr-title }}",
      SOURCE_URL: "${{ github.server_url }}/${{ github.repository }}",
      SOURCE_COMMIT: "${{ github.sha }}",
    });
    expect(destinations).toEqual([
      {
        repository: "mcp",
        "resource-directory": "servers/Azure.Mcp.Server/src/Resources",
        branch: "sync/azure-skills-references",
        "pr-title": "Sync skill references from GitHub-Copilot-for-Azure",
      },
      {
        repository: "GitHub-Copilot-for-Azure",
        "resource-directory": "telemetry-reporter/resources",
        branch: "sync/telemetry-reporter-allowlists",
        "pr-title": "chore: sync telemetry reporter allowlists",
      },
    ]);
    const upload = getStep(generation.steps, "Upload generated allowlists");
    const download = getStep(publication.steps, "Download generated allowlists");
    expect(upload.with?.name).toBe(download.with?.name);
    expect(upload.with?.path).toBe(files.map(file => `generated-allowlists/${file}`).join("\n") + "\n");
    expect(upload.with?.["if-no-files-found"]).toBe("error");
    expect(download.with?.path).toBe("generated-allowlists");
    expect(getStep(publication.steps, "Generate token for target repo").with).toEqual({
      "app-id": "${{ secrets.GHCP4A_BOT_APP_ID }}",
      "private-key": "${{ secrets.GHCP4A_BOT_PRIVATE_KEY }}",
      owner: "microsoft",
      repositories: "${{ matrix.repository }}",
    });
    expect(getStep(publication.steps, "Create or update Pull Request").if)
      .toBe("steps.commit.outputs.has_changes == 'true'");
    for (const name of [
      "Clone target repo and create feature branch",
      "Commit and push changes",
      "Create or update Pull Request",
    ]) {
      expect(getStep(publication.steps, name).env?.GH_TOKEN)
        .toBe("${{ steps.target-token.outputs.token }}");
    }
    for (const step of [...generation.steps, ...publication.steps]) {
      if (step.uses) {
        expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
      }
      if (step.run) {
        const result = spawnSync("bash", ["-n"], { input: step.run, encoding: "utf8" });
        expect(result.status, result.stderr).toBe(0);
      }
    }
  });

  describe.each(destinations)("$repository", destination => {
    it("copies, commits, and pushes only the two allowlists, then creates a PR", () => {
      const context = fixture(destination);
      prepare(context);
      writeFileSync(join(context.target, "unrelated.txt"), "local unrelated change\n");
      succeed(context, "Commit and push changes");
      succeed(context, "Create or update Pull Request");

      expect(git(context.target, "branch", "--show-current")).toBe(destination.branch);
      expect(git(context.target, "show", "--pretty=format:", "--name-only", "HEAD").split("\n").sort())
        .toEqual(files.map(file => `${destination["resource-directory"]}/${file}`).sort());
      for (const file of files) {
        expect(readFileSync(join(context.target, ...destination["resource-directory"].split("/"), file), "utf8"))
          .toBe(readFileSync(join(context.workspace, "generated-allowlists", file), "utf8"));
      }
      expect(readFileSync(join(context.target, ...destination["resource-directory"].split("/"), "allowed-tool-names.json"), "utf8"))
        .toBe('{"pinned":true}\n');
      expect(git(context.target, "status", "--short")).toBe("M unrelated.txt");
      expect(readFileSync(join(context.workspace, "workflow-output.txt"), "utf8")).toBe("has_changes=true\n");
      expect(readCalls(context.workspace, "git-calls.txt")).toContainEqual([
        "push", "--force", "origin", destination.branch,
      ]);
      const calls = readCalls(context.workspace, "gh-calls.txt");
      expect(calls[0]).toEqual([
        "repo", "clone", `microsoft/${destination.repository}`, "target-repo",
        "--", "--branch", "main", "--single-branch",
      ]);
      expect(calls.find(call => call[1] === "list")).toEqual([
        "pr", "list", "--repo", `microsoft/${destination.repository}`,
        "--head", destination.branch, "--base", "main", "--state", "open",
        "--json", "number", "--jq", ".[0].number // empty",
      ]);
      const create = calls.find(call => call[1] === "create")!;
      expect(create.slice(0, 10)).toEqual([
        "pr", "create", "--repo", `microsoft/${destination.repository}`,
        "--base", "main", "--head", destination.branch, "--title", destination["pr-title"],
      ]);
      expect(create.at(-1)).toContain("allowlists can drift");
      expect(create.at(-1)).toContain("a".repeat(40));
      expect(create.at(-1)).toContain("same generated snapshot");
      expect(calls.some(call => call[1] === "edit")).toBe(false);
    });

    it("does not commit, push, or open a PR when the destination main is current", () => {
      const context = fixture(destination, false);
      prepare(context);
      const baseline = git(context.target, "rev-parse", "HEAD");
      succeed(context, "Commit and push changes");
      expect(git(context.target, "rev-parse", "HEAD")).toBe(baseline);
      expect(readFileSync(join(context.workspace, "workflow-output.txt"), "utf8")).toBe("has_changes=false\n");
      expect(readCalls(context.workspace, "git-calls.txt").some(call => ["push", "commit"].includes(call[0]))).toBe(false);
      expect(readCalls(context.workspace, "gh-calls.txt").some(call => call[0] === "pr")).toBe(false);
    });

    it("updates an existing PR instead of opening another one", () => {
      const context = fixture(destination);
      prepare(context);
      succeed(context, "Commit and push changes");
      const result = runStep(context, "Create or update Pull Request", { EXISTING_PR: "42" });
      expect(result.status, result.stderr).toBe(0);
      const calls = readCalls(context.workspace, "gh-calls.txt");
      expect(calls.find(call => call[1] === "edit")?.slice(0, 7)).toEqual([
        "pr", "edit", "42", "--repo", `microsoft/${destination.repository}`,
        "--title", destination["pr-title"],
      ]);
      expect(calls.some(call => call[1] === "create")).toBe(false);
    });
  });

  it.each(["add", "diff", "commit", "push"])("fails explicitly when git %s fails", command => {
    const context = fixture(destinations[1]);
    prepare(context);
    const result = runStep(context, "Commit and push changes", { FAIL_GIT_COMMAND: command });
    expect(result.status).toBe(23);
    expect(existsSync(join(context.workspace, "workflow-output.txt"))).toBe(false);
    if (command === "diff") {
      expect(result.stderr).toContain("Failed to compare staged allowlists");
    }
  });

  it("fails when a generated allowlist is missing", () => {
    const context = fixture(destinations[1]);
    succeed(context, "Clone target repo and create feature branch");
    rmSync(join(context.workspace, "generated-allowlists", files[1]));
    expect(runStep(context, "Copy JSON files to target repo").status).not.toBe(0);
  });

  it.each([
    { FAIL_PR_LIST: "1" },
    { PR_EXIT_CODE: "23" },
    { PR_EXIT_CODE: "23", EXISTING_PR: "42" },
  ])("propagates GitHub PR failures: %j", overrides => {
    const context = fixture(destinations[1]);
    prepare(context);
    succeed(context, "Commit and push changes");
    expect(runStep(context, "Create or update Pull Request", overrides).status).toBe(23);
    if ("FAIL_PR_LIST" in overrides) {
      expect(readCalls(context.workspace, "gh-calls.txt").some(call => ["create", "edit"].includes(call[1]))).toBe(false);
    }
  });
});
