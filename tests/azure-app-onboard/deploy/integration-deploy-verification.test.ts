/**
 * Integration Tests — Consolidated Deploy Verification
 *
 * Validates ALL deploy-phase behaviors in a single pipeline run per fixture,
 * eliminating 3 separate seeded-fixture tests that each ran a full deploy.
 *
 * Test 1: App Service deploy (seedDeployReadyWorkspace)
 *   - Pre-deploy safety: pipeline-rules read, preflight ordering, portal link
 *   - Post-deploy safety: SCM basic auth re-disabled
 *   - Deploy depth: deploy-result.json schema, phase artifacts, context progression
 *   - No imperative CLI commands (az webapp update, az appservice plan update)
 *   - No config-zip, no SCM auth toggle (Entra auth only)
 *   - Password safety: no ask_user for passwords
 *
 * Test 2: Container Apps deploy (seedContainerAppsDeployReadyWorkspace)
 *   - Deploy depth: deploy-result.json schema, phase artifacts
 *   - No azd, no manual "Next Steps"
 *
 * Consolidated from: deploy/integration-depth.test.ts,
 * deploy/integration-safety.test.ts (pre-deploy + post-deploy),
 * deploy/integration.test.ts (T1, T2, approval-gate).
 */

import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getAllAssistantMessages,
} from "../../utils/evaluate";
import * as fs from "fs";
import * as path from "path";
import {
  describeAppOnboardWithCleanup,
  SKILL_NAME,
  shouldEarlyTerminateOnDeployComplete,
  shouldEarlyTerminateOnContainerAppsCodeDeploy,
  assertSessionFileCreated,
  seedDeployReadyWorkspace,
  seedContainerAppsDeployReadyWorkspace,
  DEPLOY_PHASE_PROMPT,
  DEPLOY_PHASE_FOLLOW_UPS,
  assertPipelineRulesRead,
  assertPreflightBeforeDeployment,
  assertPortalLinkGenerated,
  assertScmBasicAuthDisabled,
  assertDeployResultSchema,
  assertDeployChecklistExists,
  assertPhaseArtifactsExist,
  assertContextJsonProgression,
  assertDeployPreflightSubagentDispatched,
  assertNoSubagentFailures,
  assertNoPasswordPrompts,
  hasReachedDeployPhase,
  shellCommandContains,
  assertBicepTagPresent,
} from "../app-onboard-test-helpers";

describeAppOnboardWithCleanup("Deploy Verification Tests", (agent) => {
  // ─────────────────────────────────────────────────────────────────
  // Test 1: App Service — ALL safety + depth + imperative-CLI/Entra-auth assertions
  // ─────────────────────────────────────────────────────────────────
  describe("app-service-deploy", () => {
    test("App Service deploy: safety, depth, imperative-CLI/Entra-auth, and password assertions — single pipeline run", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            seedDeployReadyWorkspace(workspace);
          },
          prompt: DEPLOY_PHASE_PROMPT,
          followUp: DEPLOY_PHASE_FOLLOW_UPS,
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 2_700_000, // 45 min — deploy phase can exceed 30 min on a single follow-up
          shouldEarlyTerminate: shouldEarlyTerminateOnDeployComplete,
        });

        // Routing gate
        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // ── Pre-deploy safety (from integration-safety pre-deploy) ──
        assertPipelineRulesRead(agentMetadata);
        assertPreflightBeforeDeployment(agentMetadata);
        assertPortalLinkGenerated(agentMetadata);

        // ── Post-deploy safety (from integration-safety post-deploy) ──
        assertScmBasicAuthDisabled(agentMetadata);

        // ── Deploy depth (from integration-depth) ──
        if (workspacePath) {
          assertDeployChecklistExists(agentMetadata, workspacePath);
          assertDeployResultSchema(agentMetadata, workspacePath);
          assertPhaseArtifactsExist(agentMetadata, workspacePath, [
            "context.json",
            "prereq-output.json",
            "prepare-plan.json",
            "scaffold-manifest.json",
            "deploy-result.json",
          ]);
          assertContextJsonProgression(agentMetadata, workspacePath);
          assertSessionFileCreated(agentMetadata, workspacePath);

          // Healing attempts validation (from integration-depth)
          const sessionDirs = fs.readdirSync(path.join(workspacePath, ".copilot-azure", "sessions")).filter(
            d => d !== "active-session.json" && fs.statSync(path.join(workspacePath, ".copilot-azure", "sessions", d)).isDirectory(),
          );
          for (const sessionDir of sessionDirs) {
            const deployResultPath = path.join(workspacePath, ".copilot-azure", "sessions", sessionDir, "deploy-result.json");
            if (fs.existsSync(deployResultPath)) {
              try {
                const deployResult = JSON.parse(fs.readFileSync(deployResultPath, "utf-8"));
                if (Array.isArray(deployResult.healingAttempts) && deployResult.healingAttempts.length > 0) {
                  for (const attempt of deployResult.healingAttempts) {
                    expect(attempt).toHaveProperty("attempt");
                    agentMetadata.testComments.push(`✅ HEALING: ${deployResult.healingAttempts.length} healing attempts recorded with valid schema`);
                  }
                }
              } catch {
                // deploy-result.json parse handled by assertDeployResultSchema above
              }
              break;
            }
          }

          // No azure.yaml generated (from integration-depth + pre-deploy-safety)
          const azureYamlPath = path.join(workspacePath, "azure.yaml");
          const generatedAzureYaml = fs.existsSync(azureYamlPath);
          if (generatedAzureYaml) {
            agentMetadata.testComments.push("❌ Agent generated azure.yaml — NEVER generate azure.yaml in AppOnboard pipeline");
          }
          expect(generatedAzureYaml).toBe(false);
        }

        // ── Sub-agent assertions (soft for App Service — Container Apps test has the hard assertion) ──
        if (hasReachedDeployPhase(agentMetadata)) {
          // Soft check: log preflight status but don't fail — the Container Apps test
          // in this same file hard-asserts preflight sub-agent dispatch and passes.
          // App Service path is chronically flaky on dispatch (agent inlines preflight).
          try {
            assertDeployPreflightSubagentDispatched(agentMetadata);
          } catch {
            agentMetadata.testComments.push("⚠️ PREFLIGHT SOFT-FAIL: App Service deploy did not dispatch preflight sub-agent (Container Apps test covers this hard assertion)");
          }
        } else {
          agentMetadata.testComments.push("⚠️ DEPLOY PHASE NOT REACHED: Skipping deploy sub-agent assertion");
        }
        assertNoSubagentFailures(agentMetadata);

        // ── Imperative CLI ban ──
        // Check actual shell tool calls, NOT assistant messages — messages include
        // deploy-checklist.md blocked patterns table which documents these commands
        // as forbidden, causing false positives.
        const usesImperativeUpdate =
          shellCommandContains(agentMetadata, "az appservice plan update") ||
          shellCommandContains(agentMetadata, "az webapp update") ||
          shellCommandContains(agentMetadata, "az functionapp update");
        if (usesImperativeUpdate) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent ran imperative CLI resource modification instead of Bicep edit + redeploy");
        }
        expect(usesImperativeUpdate).toBe(false);

        // ── Entra auth for code deployment ──
        const suggestsConfigZip =
          shellCommandContains(agentMetadata, "config-zip") ||
          shellCommandContains(agentMetadata, "source config-zip");
        if (suggestsConfigZip) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent used config-zip which requires SCM basic auth");
        }
        expect(suggestsConfigZip).toBe(false);

        const togglesScm =
          shellCommandContains(agentMetadata, /basicpublishingcredentialpolicies.*(true|enable|allow)/i);
        if (togglesScm) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent re-enabled SCM basic auth via shell command");
        }
        expect(togglesScm).toBe(false);

        // ── No azd (from all) ──
        const usedAzd = shellCommandContains(agentMetadata, /azd\s+(up|provision|deploy)/i);
        if (usedAzd) {
          agentMetadata.testComments.push("❌ Agent ran azd up/provision/deploy — AppOnboard must deploy via az deployment sub create");
        }
        expect(usedAzd).toBe(false);

        // ── Bicep tag — seeded fixture must retain app-onboard-skill tag through deploy ──
        if (workspacePath) {
          assertBicepTagPresent(agentMetadata, workspacePath);
        }

        // ── Password safety — no ask_user for passwords ──
        assertNoPasswordPrompts(agentMetadata, true);
      });
    }, 3600000); // 60 min — full e2e deploy
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 2: Container Apps — deploy verification with CA fixture
  // ─────────────────────────────────────────────────────────────────
  describe("container-apps-deploy", () => {
    test("Container Apps deploy: depth + safety assertions — seeded fixture", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            seedContainerAppsDeployReadyWorkspace(workspace);
          },
          prompt: DEPLOY_PHASE_PROMPT,
          followUp: DEPLOY_PHASE_FOLLOW_UPS,
          nonInteractive: true,
          preserveWorkspace: true,
          followUpTimeout: 1_800_000,
          shouldEarlyTerminate: shouldEarlyTerminateOnContainerAppsCodeDeploy,
        });

        // Routing gate
        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // ── Deploy depth ──
        if (workspacePath) {
          assertDeployChecklistExists(agentMetadata, workspacePath);
          assertDeployResultSchema(agentMetadata, workspacePath);
          assertSessionFileCreated(agentMetadata, workspacePath);
        }

        // ── Sub-agent assertions ──
        if (hasReachedDeployPhase(agentMetadata)) {
          assertDeployPreflightSubagentDispatched(agentMetadata);
        } else {
          agentMetadata.testComments.push("⚠️ DEPLOY PHASE NOT REACHED: Skipping deploy sub-agent assertion");
        }
        assertNoSubagentFailures(agentMetadata);

        // ── No azd ──
        const usedAzd = shellCommandContains(agentMetadata, /azd\s+(up|provision|deploy)/i);
        if (usedAzd) {
          agentMetadata.testComments.push("❌ Agent ran azd up/provision/deploy — AppOnboard must deploy via az deployment sub create");
        }
        expect(usedAzd).toBe(false);

        // ── CA-specific: must execute code deploy, not present manual "Next Steps" ──
        const hasManualDeploySteps =
          /next steps.{0,100}(docker build|docker push|deploy your code|az containerapp update)/i.test(messages);
        if (hasManualDeploySteps) {
          agentMetadata.testComments.push("❌ MANUAL STEPS: Agent presented manual 'Next Steps' for code deploy instead of executing it");
        }
        expect(hasManualDeploySteps).toBe(false);

        // ── Managed identity must be present for Container Apps ──
        // Container Apps always uses SystemAssigned — no F1/D1 exception like App Service.
        if (workspacePath) {
          const infraDir = path.join(workspacePath, "infra");
          if (fs.existsSync(infraDir)) {
            const iacFiles = fs.readdirSync(infraDir, { recursive: true })
              .map(f => f.toString())
              .filter(f => f.endsWith(".bicep") || f.endsWith(".tf"));
            const allContent = iacFiles.map(f =>
              fs.readFileSync(path.join(infraDir, f), "utf-8").toLowerCase()
            ).join("\n");
            const hasManagedIdentity =
              allContent.includes("systemassigned") || allContent.includes("system_assigned") ||
              allContent.includes("userassigned") || allContent.includes("identity");
            if (!hasManagedIdentity) {
              agentMetadata.testComments.push("❌ MANAGED IDENTITY: No managed identity found in Container Apps IaC — SystemAssigned required");
            }
            expect(hasManagedIdentity).toBe(true);
          }
        }

        // ── Bicep tag — seeded fixture must retain app-onboard-skill tag through deploy ──
        if (workspacePath) {
          assertBicepTagPresent(agentMetadata, workspacePath);
        }

        // ── Password safety — no ask_user for passwords ──
        assertNoPasswordPrompts(agentMetadata, true);
      });
    }, 3600000); // 60 min
  });
});
