/**
 * Unit tests for direct-code Foundry agent workflow documentation.
 *
 * These tests lock down service-specific constraints that are easy to
 * regress because the direct-code flow is intentionally separate from the
 * default Docker/ACR hosted-agent flow.
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

  test("invoke workflow routes direct-code agents to concrete-version REST sessions", async () => {
    const invoke = await readSkillFile("foundry-agent/invoke/invoke.md");
    const reference = await readSkillFile("foundry-agent/invoke/references/direct-code-invocation.md");

    expect(invoke).toContain("Use the direct-code invocation branch only when the user explicitly says");
    expect(invoke).toContain("Do not switch to direct-code REST invocation just because the agent is hosted");
    expect(reference).toContain("Do not use `@latest` in direct-code session creation");
    expect(reference).toContain("\"type\": \"version_ref\"");
    expect(reference).toContain("\"agent_version\": \"<active-version>\"");
    expect(reference).toContain("\"agent_session_id\": \"<agent-session-id>\"");
    expect(reference).toContain("Do not pass it as an `x-agent-session-id` header");
    expect(reference).toContain("do not immediately create another session");
  });

  test("troubleshooting reference preserves direct-code failure routing and RBAC guidance", async () => {
    const troubleshoot = await readSkillFile("foundry-agent/troubleshoot/troubleshoot.md");
    const reference = await readSkillFile("foundry-agent/troubleshoot/references/direct-code-troubleshooting.md");

    expect(troubleshoot).toContain("Use the direct-code troubleshooting branch only when the user explicitly says");
    expect(reference).toContain("Check Version Status Before Looking for Logs");
    expect(reference).toContain("Do not try session logstream because there is no runtime session yet");
    expect(reference).toContain("Foundry User");
    expect(reference).toContain("Cognitive Services OpenAI User");
    expect(reference).toContain("Do not use project-level `Azure AI User` as the runtime identity fix");
    expect(reference).toContain("wait once for a bounded propagation window");
    expect(reference).toContain("do not keep rechecking role definitions or retry indefinitely");
  });

  test("agent metadata contract scopes ACR to Docker hosted-agent deployments", async () => {
    const contract = await readSkillFile("references/agent-metadata-contract.md");

    expect(contract).toContain("azureContainerRegistry");
    expect(contract).toContain("Docker/ACR deploy flow");
    expect(contract).not.toContain("✅ for hosted agents | ACR used for deployment and image refresh");
  });
});
