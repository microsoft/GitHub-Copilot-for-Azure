/**
 * Integration Tests — Container Apps Code Deploy
 *
 * Validates that azure-app-onboard deploys code to Container Apps end-to-end,
 * not just IaC with placeholder images + manual "Next Steps."
 *
 * Tests B50 (Container Apps Phase 2 code deploy missing) and
 * B59 (BuildKit Dockerfiles fail in ACR Tasks).
 *
 * Uses fullstack-starter monorepo: Next.js + FastAPI + Worker + Flutter.
 * All 3 deployable components have BuildKit Dockerfiles.
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../utils/evaluate";
import { cloneRepo } from "../utils/git-clone";
import {
  SKILL_NAME,
  shouldEarlyTerminateOnContainerAppsCodeDeploy,
  assertPhaseArtifactsExist,
  assertContextJsonProgression,
  assertSessionFileCreated,
  cleanupSessionResourceGroups,
} from "./app-onboard-test-helpers";
import * as fs from "fs";
import * as path from "path";

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Container Apps Deploy`, () => {
  const _agent = useAgentRunner();
  let lastMetadata: import("../utils/agent-runner").AgentMetadata | undefined;
  afterEach(() => { if (lastMetadata) { cleanupSessionResourceGroups(lastMetadata); lastMetadata = undefined; } });
  const agent = { run: async (...args: Parameters<typeof _agent.run>) => { const m = await _agent.run(...args); lastMetadata = m; return m; } };

  describe("container-apps-deploy", () => {
    test("e2e — fullstack-starter monorepo deploys code, not just IaC", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({
              repoUrl: "https://github.com/first-fluke/fullstack-starter",
              targetDir: workspace,
              branch: "main",
              depth: 1,
            });
            // Strip agent customization files that could override skill behavior.
            // Keep infra/ (GCP Terraform) — the agent must detect non-Azure IaC,
            // ask the user whether to modify existing or scaffold from scratch,
            // and proceed with fresh Azure Bicep. Stripping it skews the test.
            const stripDirs = [
              "AGENTS.md", "CLAUDE.md", "GEMINI.md",
              ".agents", ".claude", ".cursor", ".gemini", ".codex", ".qwen", ".serena",
            ];
            for (const d of stripDirs) {
              const p = path.join(workspace, d);
              if (fs.existsSync(p)) {
                fs.rmSync(p, { recursive: true, force: true });
              }
            }
          },
          prompt: "I'm a startup founder and need to deploy my MVP on Azure",
          followUp: [
            "Under 100 users, up to $100/month.",
            "Yes, that architecture looks good. Use Bicep for the infrastructure.",
            "Yes, proceed with scaffolding.",
            "Yes, deploy to Azure now. Build the container images with ACR and deploy them to Container Apps.",
            "Yes, confirm the deployment.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 3_900_000, // 65 min — monorepo analysis + scaffold + ACR build + Azure provisioning is the longest AppOnboard pipeline path
          shouldEarlyTerminate: shouldEarlyTerminateOnContainerAppsCodeDeploy,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        // Must invoke azure-app-onboard
        const skillInvoked = isSkillInvoked(agentMetadata, SKILL_NAME);
        setSkillInvocationRate(skillInvoked ? 1 : 0);
        expect(skillInvoked).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // HARD: Must NOT present manual CLI commands as "Next Steps" for code deploy (B50)
        const hasManualDeploySteps =
          /next steps.{0,100}(docker build|docker push|deploy your code|az containerapp update)/i.test(messages);
        if (hasManualDeploySteps) {
          agentMetadata.testComments.push(
            "❌ Agent presented manual 'Next Steps' for code deploy instead of executing ACR builds"
          );
        }
        expect(hasManualDeploySteps).toBe(false);

        // HARD: Must mention ACR build — this test validates code deploy, not just IaC (B50)
        const mentionsAcrBuild =
          /az acr build|acr.{0,20}build|container.{0,20}registry.{0,20}build|image.{0,20}(build|push)/i.test(messages);
        if (!mentionsAcrBuild) {
          agentMetadata.testComments.push(
            "❌ Agent did not execute or mention ACR image builds — code deploy phase not reached"
          );
        }
        expect(mentionsAcrBuild).toBe(true);

        // HARD: Must identify Container Apps as the target compute
        const mentionsContainerApps = /container.?apps/i.test(messages);
        if (!mentionsContainerApps) {
          agentMetadata.testComments.push("❌ Agent did not mention Container Apps");
        }
        expect(mentionsContainerApps).toBe(true);

        // HARD: Must use Bicep, NOT Terraform — Bicep is the default IaC format
        const usedTerraform = /terraform (init|plan|apply)|\.tf\b|hashicorp\/azurerm/i.test(messages);
        if (usedTerraform) {
          agentMetadata.testComments.push(
            "❌ Agent used Terraform instead of Bicep — follow-up explicitly requests Bicep"
          );
        }
        expect(usedTerraform).toBe(false);

        const mentionsBicep = /bicep|\.bicep|az deployment (sub|group) create/i.test(messages);
        if (!mentionsBicep) {
          agentMetadata.testComments.push(
            "❌ Agent did not mention Bicep or az deployment — expected Bicep scaffold flow"
          );
        }
        expect(mentionsBicep).toBe(true);

        // SOFT: Should detect monorepo components (web + api + worker)
        const detectsWeb = /web|frontend|next\.?js/i.test(messages);
        const detectsApi = /api|backend|fastapi/i.test(messages);
        const detectsWorker = /worker|background|async task/i.test(messages);
        const componentCount = [detectsWeb, detectsApi, detectsWorker].filter(Boolean).length;
        if (componentCount < 2) {
          agentMetadata.testComments.push(
            `⚠️ Only ${componentCount}/3 monorepo components detected (web=${detectsWeb}, api=${detectsApi}, worker=${detectsWorker})`
          );
        }

        // SOFT: Should notice BuildKit Dockerfiles or Dockerfile presence
        const detectsDockerfile = /dockerfile|docker|buildkit|container.{0,10}image/i.test(messages);
        if (!detectsDockerfile) {
          agentMetadata.testComments.push("⚠️ Agent did not mention Dockerfiles or BuildKit");
        }

        // SOFT: Should handle BuildKit Dockerfile incompatibility with ACR (B59)
        // The agent may handle BuildKit silently (ACR Tasks supports most BuildKit syntax)
        // or may explicitly mention conversion. Either is acceptable.
        const handlesBuildKit =
          /buildkit|dockerfile\.azure|acr.{0,30}compatible|--mount.{0,30}(remov|strip|convert|cache)|incompatible.{0,30}acr|(convert|modif|adjust|creat|prepar).{0,30}dockerfile.{0,30}(for|to).{0,10}(acr|azure)|dockerfile.{0,30}(for|to).{0,20}(acr|azure|registry)/i.test(messages);
        if (!handlesBuildKit) {
          agentMetadata.testComments.push(
            "⚠️ Agent did not explicitly mention BuildKit handling — may have handled silently via ACR Tasks"
          );
        }

        // HARD: Must NOT use azd up/deploy — AppOnboard deploys via az deployment sub create
        const usedAzd = /azd\s+(up|provision|deploy)/i.test(messages);
        if (usedAzd) {
          agentMetadata.testComments.push(
            "❌ Agent used azd up/provision/deploy — AppOnboard must deploy via az deployment sub create"
          );
        }
        expect(usedAzd).toBe(false);

        // HARD: Must NOT generate azure.yaml — AppOnboard uses az deployment, not azd
        if (workspacePath) {
          const azureYamlPath = path.join(workspacePath, "azure.yaml");
          const generatedAzureYaml = fs.existsSync(azureYamlPath);
          if (generatedAzureYaml) {
            agentMetadata.testComments.push(
              "❌ Agent generated azure.yaml — NEVER generate azure.yaml in AppOnboard pipeline"
            );
          }
          expect(generatedAzureYaml).toBe(false);
        }

        // Session integrity checks
        if (workspacePath) {
          assertSessionFileCreated(agentMetadata, workspacePath);
          assertPhaseArtifactsExist(agentMetadata, workspacePath, [
            "context.json",
            "prereq-output.json",
            "prepare-plan.json",
            "scaffold-manifest.json",
          ]);
          assertContextJsonProgression(agentMetadata, workspacePath);
        }

        // All three must hold: ACR builds executed, Container Apps targeted, no manual steps
        // (individual expects above — this is a summary guard)
        expect(mentionsAcrBuild && mentionsContainerApps && !hasManualDeploySteps).toBe(true);
      });
    }, 4500000); // 75 minutes — full e2e deploy of 3-container monorepo; 10 min headroom beyond 65-min followUpTimeout
  });
});
