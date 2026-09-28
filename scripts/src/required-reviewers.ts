/**
 * CLI script for looking up the Microsoft alias of the required reviewers of a pull request.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

interface ReviewRequestsResponse {
  users?: Array<{ login?: unknown }>;
  teams?: Array<{ slug?: unknown }>;
}

interface CodeownerMap {
  owners: { [githubUsername: string]: string };
};

type GhRunner = (args: readonly string[]) => string;

const owner = "microsoft";
const repository = "GitHub-Copilot-for-Azure";
const mappingRepository = "github-copilot-for-azure-pr";
const mappingFilePath = "codeowner_map.json";
const usage = "Usage: npm run required-reviewers -- <PR number>";

function runGh(args: readonly string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" });
}

function parsePullRequestNumber(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid pull request number "${value}".`);
  }

  return Number.parseInt(value, 10);
}

function parseArguments(args: string[]): number {
  if (args.length !== 1) {
    throw new Error(usage);
  }

  return parsePullRequestNumber(args[0]);
}

function parseReviewRequests(output: string): ReviewRequestsResponse {
  const value: unknown = JSON.parse(output);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("GitHub returned an unexpected requested reviewers response.");
  }

  return value as ReviewRequestsResponse;
}

function getRequiredReviewers(pullRequestNumber: number, gh: GhRunner = runGh): string[] {
  const endpoint = `repos/${owner}/${repository}/pulls/${pullRequestNumber}/requested_reviewers`;
  const response = parseReviewRequests(gh(["api", endpoint]));
  const usernames = new Map<string, string>();

  const addUsername = (login: string): void => {
    const normalizedLogin = login.toLowerCase();
    if (!usernames.has(normalizedLogin)) {
      usernames.set(normalizedLogin, login);
    }
  };

  for (const user of response.users ?? []) {
    if (typeof user.login === "string" && user.login.length > 0) {
      addUsername(user.login);
    }
  }

  for (const team of response.teams ?? []) {
    if (typeof team.slug !== "string" || team.slug.length === 0) {
      continue;
    }

    const members = gh([
      "api",
      `orgs/${owner}/teams/${team.slug}/members`,
      "--paginate",
      "--jq",
      ".[].login",
    ]);
    for (const login of members.split(/\r?\n/).filter(Boolean)) {
      addUsername(login);
    }
  }

  return [...usernames.values()].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}

function readUsernameMappingFile(filePath: string, gh: GhRunner = runGh): string {
  const encodedPath = filePath
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

  return gh([
    "api",
    `repos/${owner}/${mappingRepository}/contents/${encodedPath}?ref=main`,
    "-H",
    "Accept: application/vnd.github.raw+json",
  ]);
}

function reportCodeownerAlias(requiredReviewers: string[], codeownerMap: CodeownerMap): void {
  const aliases = requiredReviewers.map(githubUsername => {
    const alias = codeownerMap.owners[githubUsername];
    return alias;
  }).filter(alias => alias !== undefined);
  console.log(aliases);
}

function main(args: string[] = process.argv.slice(2), gh: GhRunner = runGh): void {
  try {
    const pullRequestNumber = parseArguments(args);
    const requiredReviewers = getRequiredReviewers(pullRequestNumber, gh);
    const mapFile = readUsernameMappingFile(mappingFilePath, gh);
    const codeownerMap = JSON.parse(mapFile) as CodeownerMap;
    reportCodeownerAlias(requiredReviewers, codeownerMap);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}

export {
  getRequiredReviewers,
  main,
  parseArguments,
  parsePullRequestNumber,
  readUsernameMappingFile,
  type GhRunner,
};
