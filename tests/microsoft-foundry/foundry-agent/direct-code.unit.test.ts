/**
 * Unit tests for direct-code Foundry agent workflow documentation.
 *
 * These tests lock down service-specific constraints that are easy to regress:
 * direct-code deployment is now the preferred azd path for standard hosted
 * agents, while container/ACR deployment remains available only when needed.
 */

import { readFile } from "fs/promises";
import path from "path";

const SKILL_NAME = "microsoft-foundry";

const readSkillFile = (relativePath: string) =>
  readFile(path.join(SKILLS_PATH, SKILL_NAME, relativePath), "utf-8");

describe("foundry-agent direct-code workflow docs", () => {
  test("create and deploy workflows prefer azd direct-code deployment", async () => {
    const createHosted = await readSkillFile("foundry-agent/create/create-hosted.md");
    const quickStart = await readSkillFile("foundry-agent/create/quick-start-hosted.md");
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(createHosted).toContain("Prefer direct code deploy at init time");
    expect(createHosted).toContain("--deploy-mode code");
    expect(createHosted).toContain("--runtime python_3_13");
    expect(createHosted).toContain("--entry-point main.py");
    expect(quickStart).toContain("| Deploy mode | `code`");
    expect(quickStart).toContain("azd ai agent init --no-prompt");
    expect(quickStart).toContain("--deploy-mode code");
    expect(deploy).toContain("Prefer **direct code deployment through azd**");
    expect(deploy).toContain("`codeConfiguration:` present | **Direct code deploy** through `azd deploy`; no Docker/ACR build.");
    expect(deploy).toContain("No `codeConfiguration:` | **Container/ACR deploy** through `azd deploy`");
    expect(deploy).toContain("Default to direct code for standard hosted-agent code.");
  });

  test("legacy manual REST direct-code reference is removed from the workflow", async () => {
    const createHosted = await readSkillFile("foundry-agent/create/create-hosted.md");
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(deploy).not.toContain("references/direct-code-deployment.md");
    await expect(readSkillFile("foundry-agent/deploy/references/direct-code-deployment.md"))
      .rejects
      .toThrow(/ENOENT/);
    expect(deploy).not.toContain("Foundry-Features: CodeAgents=V1Preview");
    expect(createHosted).not.toContain("POST /agents/<agent-name>/versions");
  });

  test("model deployments stay in azure.yaml for the azd golden path", async () => {
    const createHosted = await readSkillFile("foundry-agent/create/create-hosted.md");
    const quickStart = await readSkillFile("foundry-agent/create/quick-start-hosted.md");
    const deployModel = await readSkillFile("models/deploy-model/SKILL.md");

    expect(createHosted).toContain("`azure.yaml services.ai-project.deployments[]` is the **single source of truth**");
    expect(createHosted).toContain("Never `azd env set AI_PROJECT_DEPLOYMENTS '[...]'`");
    expect(createHosted).toContain("never `az cognitiveservices account deployment create ...`");
    expect(quickStart).toContain("Never `azd env set AI_PROJECT_DEPLOYMENTS '[...]'`");
    expect(quickStart).toContain("Never `az cognitiveservices account deployment create`");
    expect(deployModel).toContain("For azd-managed Foundry projects");
    expect(deployModel).toContain("declare deployments in `azure.yaml services.ai-project.deployments[]`");
    expect(deployModel).toContain("Use this skill only for: (a) Foundry projects not managed by an azd project");
  });

  test("direct-code deployment uses normal hosted-agent invoke and troubleshoot paths", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");
    const invoke = await readSkillFile("foundry-agent/invoke/invoke.md");
    const troubleshoot = await readSkillFile("foundry-agent/troubleshoot/troubleshoot.md");

    expect(deploy).toContain("### Step 4 -- Verify and invoke");
    expect(deploy).toContain("azd ai agent invoke \"hello, are you up?\"");
    expect(deploy).toContain("Run one remote invocation only unless the user explicitly asked");
    expect(invoke).toContain("### Step 2: Fast smoke test for azd-deployed agents");
    expect(invoke).toContain("azd ai agent invoke \"hello, are you up?\"");
    expect(invoke).toContain("## Workflow");
    expect(invoke).not.toContain("Direct Code Invocation");
    expect(troubleshoot).toContain("## Workflow");
    expect(troubleshoot).not.toContain("Direct Code Troubleshooting");
  });

  test("agent metadata contract scopes ACR to Docker hosted-agent deployments", async () => {
    const contract = await readSkillFile("references/agent-metadata-contract.md");

    expect(contract).toContain("azureContainerRegistry");
    expect(contract).toContain("Docker/ACR deploy flow");
    expect(contract).not.toContain("✅ for hosted agents | ACR used for deployment and image refresh");
  });
});
