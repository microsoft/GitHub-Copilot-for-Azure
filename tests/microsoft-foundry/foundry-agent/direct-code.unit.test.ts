/**
 * Unit tests for direct-code Foundry agent workflow documentation.
 *
 * These tests lock down service-specific constraints that are easy to
 * regress because direct-code deployment must stay scoped to deploy Step 3
 * and return to the normal hosted-agent workflow afterward.
 */

import { readFile } from "fs/promises";
import path from "path";

const SKILL_NAME = "microsoft-foundry";

const readSkillFile = (relativePath: string) =>
  readFile(path.join(SKILLS_PATH, SKILL_NAME, relativePath), "utf-8");

describe("foundry-agent direct-code workflow docs", () => {
  test("deploy workflow keeps direct-code deployment explicit opt-in", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");

    expect(deploy).toContain("Direct code deployment is opt-in only.");
    expect(deploy).toContain("references/direct-code-deployment.md");
    expect(deploy).toContain("### Step 3: Select Deployment Method and Prepare");
    expect(deploy).toContain("#### Image built and pushed to ACR");
    expect(deploy).toContain("When the direct-code version is active, skip Steps 4-6 and continue at Step 7");
    expect(deploy).toContain("Do not infer direct code deployment just because Docker is unavailable");
    expect(deploy).toContain("Deployment Method Selection");
  });

  test("deploy reference includes required REST and packaging invariants", async () => {
    const reference = await readSkillFile("foundry-agent/deploy/references/direct-code-deployment.md");

    expect(reference).toContain("Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview");
    expect(reference).toContain("https://ai.azure.com");
    expect(reference).toContain("Do not use the Cognitive Services token resource");
    expect(reference).toContain("Do not put `FOUNDRY_PROJECT_ENDPOINT` in `environment_variables`");
    expect(reference).toContain("metadata.parent.mkdir(parents=True, exist_ok=True)");
    expect(reference).toContain("The zip must be flat at the root.");
    expect(reference).toContain("Do not include a top-level wrapper folder");
    expect(reference).toContain("dependency_resolution: \"remote_build\"");
    expect(reference).toContain("Missing required query parameter: api-version");
    expect(reference).toContain("Do not send `x-ms-agent-name` on `POST /agents/<agent-name>/versions`");
  });

  test("direct-code deployment returns to deploy workflow after publish", async () => {
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");
    const deployReference = await readSkillFile("foundry-agent/deploy/references/direct-code-deployment.md");
    const invoke = await readSkillFile("foundry-agent/invoke/invoke.md");
    const troubleshoot = await readSkillFile("foundry-agent/troubleshoot/troubleshoot.md");

    expect(deploy).toContain("### Step 7: Test the Agent");
    expect(deploy).toContain("### Step 8: Auto-Generate Evaluation Suite");
    expect(deployReference).toContain("return to [deploy.md](../deploy.md#step-7-test-the-agent)");
    expect(deployReference).not.toContain("Direct code is only a deployment method");
    expect(deployReference).not.toContain("same hosted-agent protocol path");
    expect(deployReference).not.toContain("separate hosted-agent kind");
    expect(deployReference).not.toContain("invoke skill");
    expect(deployReference).not.toContain("troubleshoot skill");
    expect(deployReference).not.toContain("direct-code invocation branch");
    expect(deployReference).not.toContain("agent_session_id");
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
