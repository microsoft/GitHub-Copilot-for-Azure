/**
 * Integration Tests for azure-app-onboard/deploy subskill
 *
 * Routes prompts through the PARENT skill (azure-app-onboard) and verifies
 * that the parent delegates to the deploy subskill — evidenced by
 * deploy-domain outputs (approval gate, preflight checks, health checks,
 * error classification).
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login + azd auth login
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  shouldEarlyTerminateForSkillInvocation,
  withTestResult,
  getAllAssistantMessages,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import type { AgentMetadata } from "../../utils/agent-runner";
import {
  SKILL_NAME,
  RUNS_PER_PROMPT,
  invocationRateThreshold,
  cleanupSessionResourceGroups,
  assertNoAzdCommands,
} from "../app-onboard-test-helpers";
import * as fs from "fs";
import * as path from "path";

const testTimeoutMs = 3600000; // 60 minutes — error-classification test needs full pipeline before error injection

/**
 * Early terminate once the agent presents deploy-domain output
 * (approval gate, preflight results, or deployment commands).
 */
function shouldEarlyTerminateForDeployOutput(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    // Use generous threshold (10) — error-fix prompts require workspace exploration
    // before skill invocation (glob, view, read files). 3 was too aggressive.
    if (getToolCalls(agentMetadata).length > 10) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  const hasApprovalGate =
    messages.includes("ready to deploy") ||
    messages.includes("ready to proceed") ||
    messages.includes("shall i proceed") ||
    (messages.includes("yes") && messages.includes("edit plan") && messages.includes("cancel"));

  const hasPreflight =
    messages.includes("preflight") ||
    messages.includes("what-if") ||
    messages.includes("terraform plan") ||
    messages.includes("az deployment");

  // Agent started writing IaC or deploying
  const toolCalls = getToolCalls(agentMetadata);
  const hasScaffoldOrDeploy = toolCalls.some(tc => {
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    const isIaCWrite = (tc.data.toolName === "create_file" || tc.data.toolName === "write_file") &&
      (args.includes(".bicep") || args.includes(".tf"));
    const isDeployCmd = args.includes("azd up") || args.includes("azd provision") ||
      args.includes("az deployment") || args.includes("terraform apply");
    return isIaCWrite || isDeployCmd;
  });

  return hasApprovalGate || hasPreflight || hasScaffoldOrDeploy;
}

/**
 * Early terminate once the agent acknowledges the Bicep error or applies a fix.
 * Fires on error-fix signals so the test doesn't wait for the full AppOnboard pipeline.
 */
function shouldEarlyTerminateForErrorFix(agentMetadata: AgentMetadata): boolean {
  const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

  const identifiesError =
    messages.includes("api version") ||
    messages.includes("2024-99-01") ||
    messages.includes("invalidtemplate") ||
    messages.includes("not supported");

  // Require a concrete YYYY-MM-DD API version (not just generic words like
  // "fixed" or "replaced" which fire during exploration before the agent
  // actually suggests a version). Strip the known-bad version first.
  const messagesWithoutBad = messages.replace(/2024-99-01/g, "");
  const suggestsSpecificVersion = /20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/.test(messagesWithoutBad);

  // Terminate only when the agent has BOTH identified the error AND
  // suggested a specific valid API version date.
  return identifiesError && suggestsSpecificVersion;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_deploy - Integration Tests`, () => {
  const _agent = useAgentRunner();
  let lastMetadata: AgentMetadata | undefined;
  afterEach(() => { if (lastMetadata) { assertNoAzdCommands(lastMetadata); cleanupSessionResourceGroups(lastMetadata); lastMetadata = undefined; } });
  const agent = { run: async (...args: Parameters<typeof _agent.run>) => { const m = await _agent.run(...args); lastMetadata = m; return m; } };

  describe("deploy-delegation", () => {
    test("parent invokes azure-app-onboard and reaches deploy-domain output", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          // Golden prompt — proven to route to azure-app-onboard (from prompts.json)
          const agentMetadata = await agent.run({
            prompt: "I have an app in GitHub — can you deploy it to Azure for me?",
            nonInteractive: true,
            shouldEarlyTerminate: (metadata) =>
              shouldEarlyTerminateForDeployOutput(metadata) ||
              shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
          });

          softCheckSkill(agentMetadata, SKILL_NAME);

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount++;
          }
        }

        const invocationRate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(invocationRate);
        expect(invocationRate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    }, testTimeoutMs);
  });

  describe("deploy-depth", () => {
    test("approval gate reached via multi-turn pipeline", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            "Just go with defaults, cheapest option.",
            "Yes",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForDeployOutput,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must reach approval gate or deploy phase
        const reachedDeployPhase =
          messages.includes("ready to proceed") ||
          messages.includes("ready to deploy") ||
          messages.includes("shall i proceed") ||
          messages.includes("would you like") ||
          messages.includes("approve") ||
          (messages.includes("deploy") && (messages.includes("yes") || messages.includes("cancel")));

        if (!reachedDeployPhase) {
          agentMetadata.testComments.push("⚠️ DEPLOY PHASE NOT REACHED: agent did not present approval gate or deploy prompt");
        }

        // Must mention infrastructure (Bicep, IaC, App Service, etc.)
        const mentionsInfra =
          messages.includes("bicep") || messages.includes("app service") ||
          messages.includes("container apps") || messages.includes("infra") ||
          messages.includes("infrastructure") || messages.includes("terraform");

        if (!mentionsInfra) {
          agentMetadata.testComments.push("⚠️ No infrastructure/IaC mentioned — may not have reached scaffold/deploy phase");
        }

        // Must mention cost
        const mentionsCost =
          messages.includes("$") || messages.includes("cost") ||
          messages.includes("free") || messages.includes("f1") || messages.includes("estimate");

        if (!mentionsCost) {
          agentMetadata.testComments.push("⚠️ No cost information presented");
        }

        expect(mentionsInfra || mentionsCost || reachedDeployPhase).toBe(true);
      });
    }, testTimeoutMs);

    test("error classification routes back to scaffold fix", async () => {
      // Test error classification directly by giving the agent a workspace with broken IaC.
      // Previous approach: full pipeline (prompt → pipeline → follow-up with error) timed out
      // chronically at 30m because the agent burns 20+ minutes on prereq/prepare/scaffold
      // before the error follow-up is ever injected.
      //
      // Fix: clone the app repo AND write a broken Bicep file with a bad API version into
      // the workspace. The agent sees real app code + real broken IaC, classifies the error
      // as IAC_ERROR, and suggests the correct API version — without burning 30m on pipeline
      // phases that aren't under test.
      //
      // Prompt uses proven golden prompt base ("help me get it to production on Azure") for
      // reliable azure-app-onboard routing, plus action verb "Check and fix" per golden-prompt-log.md
      // insight: action verbs are needed for skill invocation triggers.
      // Early-terminates on error-fix signals so we don't wait for the full AppOnboard pipeline.
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
            // Write a broken Bicep file with an invalid API version
            const infraDir = path.join(workspace, "infra");
            fs.mkdirSync(infraDir, { recursive: true });
            fs.writeFileSync(path.join(infraDir, "main.bicep"), [
              "targetScope = 'resourceGroup'",
              "",
              "param location string = resourceGroup().location",
              "param appName string = 'bya-simple-web-app'",
              "",
              "resource appServicePlan 'Microsoft.Web/serverfarms@2024-99-01' = {",
              "  name: '${appName}-plan'",
              "  location: location",
              "  sku: {",
              "    name: 'F1'",
              "    tier: 'Free'",
              "  }",
              "  kind: 'linux'",
              "  properties: {",
              "    reserved: true",
              "  }",
              "}",
              "",
              "resource webApp 'Microsoft.Web/sites@2024-99-01' = {",
              "  name: appName",
              "  location: location",
              "  properties: {",
              "    serverFarmId: appServicePlan.id",
              "    siteConfig: {",
              "      linuxFxVersion: 'NODE|20-lts'",
              "    }",
              "  }",
              "}",
            ].join("\n"));
          },
          prompt: "I have a prototype ready — help me get it to production on Azure. My Bicep deployment failed with: InvalidTemplate — API version '2024-99-01' is not supported for resource type 'Microsoft.Web/sites'. Check and fix the broken infrastructure code.",
          nonInteractive: true,
          preserveWorkspace: true,
          followUp: [
            "Yes, please fix it.",
          ],
          // Only use error-fix termination — NOT shouldEarlyTerminateForDeployOutput.
          // DeployOutput's routing-failure check (tool calls > N without skill invocation)
          // kills this test prematurely because the agent explores the workspace (glob, view)
          // before the skill is formally invoked. Error-fix uses && so it waits for BOTH
          // error identification AND a specific fix suggestion.
          shouldEarlyTerminate: shouldEarlyTerminateForErrorFix,
        });

        // Routing is diagnostic-only — the agent may fix the error without invoking azure-app-onboard
        softCheckSkill(agentMetadata, SKILL_NAME);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Must identify the API version error — the bad version or the error type
        const identifiesError =
          messages.includes("api version") || messages.includes("2024-99-01") ||
          messages.includes("invalidtemplate") || messages.includes("not supported");

        // Must suggest or apply a fix (a real API version, not just generic "update")
        // Match any valid YYYY-MM-DD API version that isn't the known-bad 2024-99-01
        const messagesWithoutBadVersion = messages.replace(/2024-99-01/g, "");
        const suggestsSpecificFix = /20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/.test(messagesWithoutBadVersion);

        if (!identifiesError) {
          agentMetadata.testComments.push("⚠️ Agent did not identify the API version error");
        }
        if (!suggestsSpecificFix) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest a specific valid API version");
        }

        // Hard: must identify the error
        expect(identifiesError).toBe(true);
        // Hard: must suggest a specific valid API version (not just "update" or "fix")
        expect(suggestsSpecificFix).toBe(true);
      });
    }, 600000); // 10m — error-fix should complete in 1-2 turns with early termination
  });

  describe("deploy-safety", () => {
    test("T1 — imperative CLI ban on SKU change (B16)", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I just signed up for Azure. What's the fastest way to bring my app over?",
          followUp: [
            "Just go with defaults, cheapest option.",
            "Yes, proceed.",
            "It failed with: Quota for SKU F1 in region eastus is 0. Can you try a different SKU?",
            "No, don't deploy. Just show me what you'd change.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForDeployOutput,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must NOT use imperative resource modification
        const usesImperativeUpdate =
          messages.includes("az appservice plan update") ||
          messages.includes("az webapp update") ||
          messages.includes("az functionapp update");
        if (usesImperativeUpdate) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent suggested imperative CLI resource modification (az appservice plan update / az webapp update) instead of Bicep edit + redeploy");
        }
        expect(usesImperativeUpdate).toBe(false);

        // Soft: should suggest Bicep edit + redeploy
        const suggestsBicepEdit =
          (messages.includes("bicep") || messages.includes("main.bicep") || messages.includes("resources.bicep")) &&
          (messages.includes("edit") || messages.includes("update") || messages.includes("change") || messages.includes("modify"));
        if (!suggestsBicepEdit) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest editing Bicep files for SKU change");
        }

        const suggestsRedeploy =
          messages.includes("az deployment") || messages.includes("redeploy") || messages.includes("recompile");
        if (!suggestsRedeploy) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest redeploying after Bicep edit");
        }
      });
    }, testTimeoutMs);

    test("T2 — Entra auth for code deployment (B17)", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I want to take my local app and put it in the cloud — where do I start?",
          followUp: [
            "Just go with defaults.",
            "Yes, proceed.",
            "Deployment failed with 401 Unauthorized on zip deploy. SCM basic auth is disabled. How do I deploy my code?",
            "No, don't deploy. Just tell me the right command.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForDeployOutput,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must NOT suggest config-zip (SCM-dependent)
        const suggestsConfigZip =
          messages.includes("config-zip") || messages.includes("source config-zip");
        if (suggestsConfigZip) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent suggested config-zip which requires SCM basic auth");
        }
        expect(suggestsConfigZip).toBe(false);

        // Hard: must NOT suggest toggling SCM auth back on
        const togglesScm =
          /basicpublishingcredentialpolicies.*(true|enable|allow)/i.test(messages);
        if (togglesScm) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent suggested re-enabling SCM basic auth instead of using Entra-auth deployment");
        }
        expect(togglesScm).toBe(false);

        // Soft: should suggest az webapp deploy (Entra auth method)
        const suggestsWebappDeploy = messages.includes("az webapp deploy");
        if (!suggestsWebappDeploy) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest 'az webapp deploy' (Entra-auth deployment method)");
        }
      });
    }, testTimeoutMs);

    test("T3 — no imperative CLI fallback on auth error (B12/B30)", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            "Use Terraform for the infrastructure.",
            "Yes, proceed.",
            "Terraform failed with AADSTS530084: The access token is not from an allowed client application. Conditional access policy blocks Terraform's token flow.",
            "No, don't deploy. Just explain my options.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForDeployOutput,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Hard: must NOT fall back to imperative resource creation
        const fallsBackToCli =
          messages.includes("az group create") ||
          messages.includes("az appservice plan create") ||
          messages.includes("az webapp create");
        if (fallsBackToCli) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent fell back to imperative CLI resource creation (az group/appservice/webapp create) instead of classifying as ENVIRONMENT_BLOCKING");
        }
        expect(fallsBackToCli).toBe(false);

        // Hard: must NOT suggest Graph scope
        const suggestsGraphScope = messages.includes("graph.microsoft.com");
        if (suggestsGraphScope) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent suggested graph.microsoft.com scope for ARM deployment auth");
        }
        expect(suggestsGraphScope).toBe(false);

        // Soft: should classify as environment blocking
        const classifiesBlocking =
          messages.includes("environment") || messages.includes("blocking") ||
          messages.includes("conditional access") || messages.includes("cannot authenticate") ||
          messages.includes("policy");
        if (!classifiesBlocking) {
          agentMetadata.testComments.push("⚠️ Agent did not classify auth error as environment-blocking");
        }

        // Soft: should offer Bicep alternative
        const offersBicep =
          messages.includes("bicep") || messages.includes("az deployment");
        if (!offersBicep) {
          agentMetadata.testComments.push("⚠️ Agent did not offer Bicep as alternative to blocked Terraform");
        }
      });
    }, testTimeoutMs);

    test("T4 — region change requires re-approval (B20)", async () => {
      // Custom early-term: let the agent run through the multi-turn pipeline
      // until we've injected the quota error (followUp[2]), then terminate once
      // the agent responds to it. We detect this by counting tool calls — the
      // first 3 turns generate ~6-8 calls each, so after ~15 total the quota
      // error response should be in the messages.
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "Can you walk me through getting my first app on Azure?",
          followUp: [
            "Just go with defaults, deploy to eastus.",
            "Yes, proceed.",
            "Deployment failed: No quota available for any App Service SKU in eastus. What should we do?",
            "No, don't deploy. That's all I needed.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: (metadata) => {
            // Bail on routing failure only — don't kill agent after successful invocation
            if (!isSkillInvoked(metadata, SKILL_NAME)) {
              if (getToolCalls(metadata).length > 3) return true;
              return false;
            }
            // Don't terminate until we've had enough turns for the quota error to be injected
            const calls = getToolCalls(metadata).length;
            if (calls < 10) return false;
            return shouldEarlyTerminateForDeployOutput(metadata);
          },
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: should present alternative regions
        const presentsRegions =
          messages.includes("eastus2") || messages.includes("westus") ||
          messages.includes("westus2") || messages.includes("centralus");
        if (!presentsRegions) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest alternative regions after quota failure");
        }

        // Hard: must ask for approval before switching region
        const asksForApproval =
          messages.includes("approve") || messages.includes("proceed") ||
          messages.includes("confirm") || messages.includes("updated plan") ||
          messages.includes("ready to deploy") || messages.includes("would you like");
        if (!asksForApproval) {
          agentMetadata.testComments.push("❌ DEPLOY VIOLATION: Agent changed region without re-presenting approval gate");
        }
        expect(asksForApproval).toBe(true);
      });
    }, testTimeoutMs);

    test("T5 — zip creation with correct structure (B18)", async () => {
      await withTestResult(async () => {
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I'm new to Azure. Can you get my existing app running without me setting up infrastructure?",
          followUp: [
            "Just go with defaults.",
            "Yes, proceed.",
            "How should I create the zip file for deployment?",
            "No, don't deploy.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForDeployOutput,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        const messages = getAllAssistantMessages(agentMetadata).toLowerCase();

        // Soft: should suggest ZipFile class or relative paths
        const suggestsCorrectZip =
          messages.includes("zipfile") || messages.includes("system.io.compression") ||
          (messages.includes("zip") && messages.includes("relative"));
        if (!suggestsCorrectZip) {
          agentMetadata.testComments.push("⚠️ Agent did not suggest System.IO.Compression.ZipFile or relative paths for zip creation");
        }

        // Soft: should NOT suggest Compress-Archive with FullName
        const suggestsBadPattern =
          /compress-archive.*fullname|\$files\.fullname/i.test(messages);
        if (suggestsBadPattern) {
          agentMetadata.testComments.push("⚠️ Agent suggested Compress-Archive with FullName — loses directory structure");
        }
      });
    }, testTimeoutMs);
  });
});
