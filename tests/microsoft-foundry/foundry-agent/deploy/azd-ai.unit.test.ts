/**
 * Unit tests for the azd-based hosted-agent deploy workflow.
 *
 * Locks down the azd provision/deploy/show patterns introduced by the
 * foundry-agent/deploy rewrite so the skill does not regress back to
 * Docker/ACR-first deployment or to the direct-code REST upload branch.
 */

import { readFile, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";

const SKILL_NAME = "microsoft-foundry";

const readSkillFile = (relativePath: string) =>
  readFile(path.join(SKILLS_PATH, SKILL_NAME, relativePath), "utf-8");

const fileExists = async (relativePath: string) => {
  try {
    await access(path.join(SKILLS_PATH, SKILL_NAME, relativePath), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

describe("foundry-agent deploy (azd ai)", () => {
  test("describes the hosted-agent azd provision + deploy workflow", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(deploy).toContain("azd provision --no-prompt");
    expect(deploy).toContain("azd deploy --no-prompt");
    expect(deploy).toContain("azd ai agent show --output json");
    expect(deploy).toContain("azd ai agent invoke");
    expect(deploy).toContain("azd ai agent endpoint update");
    expect(deploy).toContain(".agentignore");
    expect(deploy).toContain("AGENT_<SVC>_VERSION");
  });

  test("retains a prompt-agent workflow via MCP agent_update", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(deploy).toContain("Workflow -- Prompt agent (MCP)");
    expect(deploy).toContain("agent_definition_schema_get");
    expect(deploy).toContain("agent_update");
    expect(deploy).toContain("\"kind\": \"prompt\"");
  });

  test("does not advertise the old Docker/ACR-first or direct-code flow", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(deploy).not.toContain("az acr build --registry");
    expect(deploy).not.toContain("docker build --platform linux/amd64");
    expect(deploy).not.toContain("Direct code deployment is opt-in only.");
    expect(deploy).not.toContain("references/direct-code-deployment.md");
    expect(deploy).not.toContain("Step 8 - Auto-Generate Evaluation Suite");
    expect(deploy).not.toContain("Definition of Done");
  });

  test("removes the deprecated direct-code reference file", async () => {
    const directCodeExists = await fileExists(
      "foundry-agent/deploy/references/direct-code-deployment.md"
    );
    expect(directCodeExists).toBe(false);
  });

  test("hands off to the right downstream skills", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(deploy).toContain("../invoke/invoke.md");
    expect(deploy).toContain("../observe/observe.md");
    expect(deploy).toContain("../troubleshoot/troubleshoot.md");
    expect(deploy).toContain("../trace/trace.md");
  });
});
