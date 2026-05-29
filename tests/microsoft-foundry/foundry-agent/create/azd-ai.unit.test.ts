/**
 * Unit tests for the azd-based hosted-agent create workflow.
 *
 * Locks down the azd ai patterns introduced by the foundry-agent/create
 * rewrite so the skill does not silently regress back to Docker/ACR-first
 * or framework-protocol-matrix scaffolding.
 */

import { readFile } from "fs/promises";
import path from "path";

const SKILL_NAME = "microsoft-foundry";

const readSkillFile = (relativePath: string) =>
  readFile(path.join(SKILLS_PATH, SKILL_NAME, relativePath), "utf-8");

describe("foundry-agent create-hosted (azd ai)", () => {
  test("describes the azd ai agent init workflow", async () => {
    const skill = await readSkillFile("foundry-agent/create/create-hosted.md");

    expect(skill).toContain("azd ai agent sample list");
    expect(skill).toContain("azd ai agent init");
    expect(skill).toContain("-m \"<manifestUrl>\"");
    expect(skill).toContain("--from-code");
    expect(skill).toContain("azd ai agent run");
    expect(skill).toContain("azd ai agent invoke --local");
  });

  test("does not advertise the old framework/protocol scaffolding matrix", async () => {
    const skill = await readSkillFile("foundry-agent/create/create-hosted.md");

    expect(skill).not.toContain("microsoft-foundry/foundry-samples/contents");
    expect(skill).not.toContain("agent-framework-foundry-hosting");
    expect(skill).not.toContain("azure-ai-agentserver-responses");
    expect(skill).not.toContain("ResponsesHostServer");
    expect(skill).not.toContain("invocations-ws skill");
    expect(skill).not.toContain("references/agentframework.md");
    expect(skill).not.toContain("references/use-toolbox-in-hosted-agent.md");
  });

  test("links to the new azd-focused references", async () => {
    const skill = await readSkillFile("foundry-agent/create/create-hosted.md");

    expect(skill).toContain("references/azd-ai-cli.md");
    expect(skill).toContain("references/local-run.md");
    expect(skill).toContain("references/tools.md");
  });

  test("tools reference uses azd ai toolbox and the env var convention", async () => {
    const tools = await readSkillFile("foundry-agent/create/references/tools.md");

    expect(tools).toContain("azd extension install azure.ai.toolboxes");
    expect(tools).toContain("azd ai toolbox create");
    expect(tools).toContain("azd ai toolbox connection add");
    expect(tools).toContain("TOOLBOX_AGENT_TOOLS_MCP_ENDPOINT");
    expect(tools).toContain("Foundry-Features: Toolboxes=V1Preview");
    expect(tools).toContain("https://ai.azure.com/.default");
    expect(tools).toContain("azd env set TOOLBOX_");
  });

  test("local-run reference documents azd ai agent run", async () => {
    const localRun = await readSkillFile("foundry-agent/create/references/local-run.md");

    expect(localRun).toContain("azd ai agent run");
    expect(localRun).toContain("azd ai agent invoke --local");
    expect(localRun).toContain("--no-inspector");
    expect(localRun).toContain("--start-command");
  });

  test("azd-ai-cli reference covers the two-file model", async () => {
    const cli = await readSkillFile("foundry-agent/create/references/azd-ai-cli.md");

    expect(cli).toContain("<service-dir>/agent.yaml");
    expect(cli).toContain("azure.yaml services.<name>.config");
    expect(cli).toContain("AGENT_<SVC>_NAME");
    expect(cli).toContain("_VERSION");
    expect(cli).toContain("azd ai project show");
    expect(cli).toContain("azd ai agent doctor");
  });
});
