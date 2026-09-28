import { describe, expect, it, vi } from "vitest";
import {
  getRequiredReviewers,
  main,
  parseArguments,
  parsePullRequestNumber,
  readUsernameMappingFile,
  type GhRunner,
} from "../required-reviewers.js";

describe("required reviewers", () => {
  it("parses a pull request number", () => {
    expect(parsePullRequestNumber("3262")).toBe(3262);
  });

  it("rejects a non-numeric pull request reference", () => {
    expect(() => parsePullRequestNumber("microsoft/example#42")).toThrow(
      'Invalid pull request number "microsoft/example#42".',
    );
  });

  it("parses the pull request number", () => {
    expect(parseArguments(["3262"])).toBe(3262);
  });

  it("returns requested users and expands requested teams", () => {
    const gh = vi.fn<GhRunner>((args) => {
      if (args[1] === "repos/microsoft/GitHub-Copilot-for-Azure/pulls/42/requested_reviewers") {
        return JSON.stringify({
          users: [{ login: "octocat" }, { login: "hubot" }],
          teams: [{ slug: "maintainers" }],
        });
      }

      if (args[1] === "orgs/microsoft/teams/maintainers/members") {
        return "Hubot\nmonalisa\n";
      }

      throw new Error(`Unexpected gh arguments: ${args.join(" ")}`);
    });

    expect(
      getRequiredReviewers(42, gh),
    ).toEqual(["hubot", "monalisa", "octocat"]);
  });

  it("reads the raw code owner mapping file from the main branch", () => {
    const gh = vi.fn<GhRunner>().mockReturnValue('{"owners":{"octocat":"other-user"}}\n');

    expect(readUsernameMappingFile("config/reviewer mapping.json", gh)).toBe(
      '{"owners":{"octocat":"other-user"}}\n',
    );
    expect(gh).toHaveBeenCalledWith([
      "api",
      "repos/microsoft/github-copilot-for-azure-pr/contents/config/reviewer%20mapping.json?ref=main",
      "-H",
      "Accept: application/vnd.github.raw+json",
    ]);
  });

  it("reports mapped aliases and omits unmatched reviewers", () => {
    const gh = vi.fn<GhRunner>((args) => {
      if (args[1] === "repos/microsoft/GitHub-Copilot-for-Azure/pulls/42/requested_reviewers") {
        return JSON.stringify({
          users: [{ login: "octocat" }, { login: "hubot" }],
          teams: [],
        });
      }

      if (args[1] === "repos/microsoft/github-copilot-for-azure-pr/contents/codeowner_map.json?ref=main") {
        return JSON.stringify({
          owners: {
            hubot: "hubot-alias",
          },
        });
      }

      throw new Error(`Unexpected gh arguments: ${args.join(" ")}`);
    });
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => { });

    main(["42"], gh);

    expect(consoleLog).toHaveBeenCalledOnce();
    expect(consoleLog).toHaveBeenCalledWith(["hubot-alias"]);
    expect(process.exitCode).not.toBe(1);
  });
});
