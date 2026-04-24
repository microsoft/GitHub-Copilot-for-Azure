/**
 * Integration Tests for azure-iac-generator
 *
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate,
 * and verifies end-to-end output structure for both workflows.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 3. az login (for live Azure resource access tests)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  doesAssistantMessageIncludeKeyword,
} from "../utils/agent-runner";
import {
  softCheckSkill,
  isSkillInvoked,
  shouldEarlyTerminateForSkillInvocation,
  doesWorkspaceFileIncludePattern,
  withTestResult,
} from "../utils/evaluate";

const SKILL_NAME = "azure-iac-generator";
const RUNS_PER_PROMPT = 5;
const invocationRateThreshold = 0.8;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const iacTestTimeoutMs = 1800000;

// Minimal Draw.io XML representing an App Service + Storage Account architecture
const SAMPLE_DRAWIO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile><diagram><mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="App Service" style="shape=mxgraph.azure2.app_service;" vertex="1" parent="1"><mxGeometry x="100" y="100" width="50" height="50" as="geometry"/></mxCell>
    <mxCell id="3" value="Storage Account" style="shape=mxgraph.azure2.storage_account;" vertex="1" parent="1"><mxGeometry x="300" y="100" width="50" height="50" as="geometry"/></mxCell>
    <mxCell id="4" edge="1" source="2" target="3" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>
  </root>
</mxGraphModel></diagram></mxfile>`;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();

  // ──────────────────────────────────────────────────────────────────
  // Skill invocation rate tests
  // ──────────────────────────────────────────────────────────────────
  describe("skill-invocation", () => {
    test(
      "invokes skill for live-Azure reverse-engineering prompt",
      () =>
        withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              prompt:
                "Generate Bicep templates by reverse engineering my Azure resource group named my-rg in subscription 00000000-0000-0000-0000-000000000000",
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        }),
      iacTestTimeoutMs
    );

    test(
      "invokes skill for export infrastructure as code prompt",
      () =>
        withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              prompt:
                "Export my Azure infrastructure as code using Bicep for my resource group",
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        }),
      iacTestTimeoutMs
    );

    test(
      "invokes skill for diagram-to-Bicep prompt",
      () =>
        withTestResult(async ({ setSkillInvocationRate }) => {
          let invocationCount = 0;
          for (let i = 0; i < RUNS_PER_PROMPT; i++) {
            const agentMetadata = await agent.run({
              setup: async (workspace: string) => {
                fs.writeFileSync(
                  path.join(workspace, "architecture.drawio"),
                  SAMPLE_DRAWIO_XML
                );
              },
              prompt:
                "Generate Bicep templates from my Draw.io architecture diagram at architecture.drawio",
              shouldEarlyTerminate: (metadata) =>
                shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME),
            });

            softCheckSkill(agentMetadata, SKILL_NAME);
            if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
              invocationCount += 1;
            }
          }
          const rate = invocationCount / RUNS_PER_PROMPT;
          setSkillInvocationRate(rate);
          expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
        }),
      iacTestTimeoutMs
    );
  });

  // ──────────────────────────────────────────────────────────────────
  // Response quality tests — diagram-to-Bicep (no Azure auth needed)
  // ──────────────────────────────────────────────────────────────────
  describe("response-quality", () => {
    test(
      "generates main.bicep from a Draw.io diagram",
      () =>
        withTestResult(async () => {
          let workspacePath: string | undefined;

          await agent.run({
            setup: async (workspace: string) => {
              workspacePath = workspace;
              fs.writeFileSync(
                path.join(workspace, "architecture.drawio"),
                SAMPLE_DRAWIO_XML
              );
            },
            prompt:
              "Generate Bicep templates from my architecture diagram at architecture.drawio. Output files into a folder named my-app.",
            nonInteractive: true,
            followUp: ["Continue until all files are written."],
          });

          expect(workspacePath).toBeDefined();
          const hasMainBicep = doesWorkspaceFileIncludePattern(
            workspacePath!,
            /targetScope|module\s+\w+|param\s+\w+/,
            /main\.bicep$/
          );
          expect(hasMainBicep).toBe(true);
        }),
      iacTestTimeoutMs
    );

    test(
      "places resources in modules/, not inline in main.bicep",
      () =>
        withTestResult(async () => {
          let workspacePath: string | undefined;

          await agent.run({
            setup: async (workspace: string) => {
              workspacePath = workspace;
              fs.writeFileSync(
                path.join(workspace, "architecture.drawio"),
                SAMPLE_DRAWIO_XML
              );
            },
            prompt:
              "Generate modular Bicep from my architecture.drawio diagram. Output to folder named my-app.",
            nonInteractive: true,
            followUp: ["Continue until all files are written."],
          });

          expect(workspacePath).toBeDefined();
          // main.bicep should reference modules, not declare resources directly
          const mainBicepUsesModules = doesWorkspaceFileIncludePattern(
            workspacePath!,
            /module\s+\w+/,
            /main\.bicep$/
          );
          expect(mainBicepUsesModules).toBe(true);
        }),
      iacTestTimeoutMs
    );

    test(
      "response mentions authentication requirement for live Azure workflow",
      () =>
        withTestResult(async () => {
          const agentMetadata = await agent.run({
            prompt:
              "Generate Bicep from my Azure resource group prod-rg in subscription 00000000-0000-0000-0000-000000000000",
          });

          const mentionsAuth =
            doesAssistantMessageIncludeKeyword(agentMetadata, "az login") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "authenticated") ||
            doesAssistantMessageIncludeKeyword(agentMetadata, "authentication");
          expect(mentionsAuth).toBe(true);
        }),
      iacTestTimeoutMs
    );

    test(
      "generates a .bicepparam file alongside main.bicep",
      () =>
        withTestResult(async () => {
          let workspacePath: string | undefined;

          await agent.run({
            setup: async (workspace: string) => {
              workspacePath = workspace;
              fs.writeFileSync(
                path.join(workspace, "architecture.drawio"),
                SAMPLE_DRAWIO_XML
              );
            },
            prompt:
              "Generate Bicep from architecture.drawio. Output to folder my-app.",
            nonInteractive: true,
            followUp: ["Continue until all files are written."],
          });

          expect(workspacePath).toBeDefined();
          const hasBicepparam = doesWorkspaceFileIncludePattern(
            workspacePath!,
            /using\s+['"].*main\.bicep['"]/,
            /\.bicepparam$/
          );
          expect(hasBicepparam).toBe(true);
        }),
      iacTestTimeoutMs
    );
  });
});
