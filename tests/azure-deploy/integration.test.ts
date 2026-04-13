/**
 * Integration Tests for azure-deploy
 * 
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../utils/agent-runner";
import { hasDeployLinks, softCheckDeploySkills, softCheckContainerDeployEnvVars, shouldEarlyTerminateForCompletedDeployment } from "./utils";
import { cloneRepo } from "../utils/git-clone";
import { expectFiles, softCheckSkill, doesWorkspaceFileIncludePattern, shouldEarlyTerminateForSkillInvocation, isSkillInvoked, withTestResult } from "../utils/evaluate";

const SKILL_NAME = "azure-deploy";
const RUNS_PER_PROMPT = 1;
const ASPIRE_SAMPLES_REPO = "https://github.com/dotnet/aspire-samples.git";
const invocationRateThreshold = 0.8;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;
const deployTestTimeoutMs = 1800000;
const brownfieldTestTimeoutMs = 2700000;

const pseudoRandomResourceGroupNameSystemPromptModifier: {
  mode: "append",
  content: string
} = {
  mode: "append",
  content: "Use pseudo random name resource group name such that it is less likely to have collision with existing ones."
};

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();
  describe("skill-invocation", () => {
    const followUp = ["Continue with recommended options until complete."];
    test("invokes azure-deploy skill for deployment prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Run azd up to deploy my already-prepared app to Azure",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-deploy skill for publish to Azure prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "My app already has azure.yaml and infra/ configured. Publish it to Azure now.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-deploy skill for Azure Functions deployment prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Deploy my existing Azure Functions project to the cloud. The infrastructure and azure.yaml are already set up.",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-deploy skill for live RBAC role verification prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Deploy my app to Azure and verify the live RBAC role assignments are correct after provisioning",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });

    test("invokes azure-deploy skill for post-deployment role assignment check prompt", async () => {
      await withTestResult(async ({ setSkillInvocationRate }) => {
        let invocationCount = 0;
        for (let i = 0; i < RUNS_PER_PROMPT; i++) {
          const agentMetadata = await agent.run({
            prompt: "Deploy my already-prepared Azure app and confirm the managed identity roles are properly assigned",
            nonInteractive: true,
            followUp,
            shouldEarlyTerminate: (metadata) => shouldEarlyTerminateForSkillInvocation(metadata, SKILL_NAME)
          });

          softCheckSkill(agentMetadata, SKILL_NAME);
          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            invocationCount += 1;
          }
        }
        const rate = invocationCount / RUNS_PER_PROMPT;
        setSkillInvocationRate(rate);
        expect(rate).toBeGreaterThanOrEqual(invocationRateThreshold);
      });
    });
  });

  // Need to be logged into azd for these tests. 
  // azd auth login
  const FOLLOW_UP_PROMPT = ["Go with recommended options and proceed with Azure deployment."];
  // Static Web Apps (SWA)
  describe("static-web-apps-deploy", () => {
    test("creates whiteboard application", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a static whiteboard web app and deploy to Azure using my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

    test("creates static portfolio website", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a static portfolio website and deploy to Azure using my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

  });

  // App Service
  describe("app-service-deploy", () => {
    test("creates discussion board", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a discussion board application and deploy to Azure App Service using my current subscription in westus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

    test("creates todo list with frontend and API", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a todo list with frontend and API and deploy to Azure App Service using my current subscription in westus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

  });

  // Azure Functions
  describe("azure-functions-deploy", () => {
    test("creates serverless HTTP API", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

    test("creates event-driven function app", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

    test("creates Python function app with Service Bus trigger", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create an azure python function app that takes input from a service bus trigger and does message processing and deploy to Azure using my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);
  });

  // Durable Task Scheduler (Durable Functions with DTS)
  describe("durable-task-scheduler-deploy", () => {
    test("creates and deploys workflow app with Durable Task Scheduler", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a workflow app that orchestrates a multi-step order processing pipeline and deploy to Azure using my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        expect(workspacePath).toBeDefined();
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);

        // Verify DTS-specific Bicep content on disk
        const bicepPattern = /\.bicep$/;
        expect(doesWorkspaceFileIncludePattern(workspacePath!, /Microsoft\.DurableTask\/schedulers/i, bicepPattern)).toBe(true);
        expect(doesWorkspaceFileIncludePattern(workspacePath!, /Microsoft\.DurableTask\/schedulers\/taskHubs/i, bicepPattern)).toBe(true);
        expect(doesWorkspaceFileIncludePattern(workspacePath!, /0ad04412-c4d5-4796-b79c-f76d14c8d402/i, bicepPattern)).toBe(true);

        const containsDeployLinks = hasDeployLinks(agentMetadata);
        expect(containsDeployLinks).toBe(true);
      });
    }, deployTestTimeoutMs);
  });

  // Azure Container Apps (ACA) - not custom IaC specification
  describe("vanilla-azure-container-apps-deploy", () => {
    test("creates containerized web application", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a containerized web application and deploy to Azure Container Apps using my current subscription in swedencentral region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

    test("creates simple containerized Node.js app", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using my current subscription in swedencentral region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
      });
    }, deployTestTimeoutMs);

  });

  // Terraform - Static Web Apps
  describe("terraform-static-web-apps-deploy", () => {
    test("creates whiteboard application with Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a static whiteboard web app and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);

    test("creates static portfolio website with Terraform infrastructure", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a static portfolio website and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);
  });

  // Terraform - App Service
  describe("terraform-app-service-deploy", () => {
    test("creates discussion board with Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a discussion board application and deploy to Azure App Service, prefer Terraform over Bicep, in my current subscription in westus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);

    test("creates todo list with frontend and API using Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a todo list with frontend and API and deploy to Azure App Service using Terraform infrastructure in my current subscription in westus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);
  });

  // Terraform - Azure Functions
  describe("terraform-azure-functions-deploy", () => {
    test("creates serverless HTTP API with Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);

    test("creates event-driven function app with Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using Terraform infrastructure in my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);

    test("creates URL shortener service with Terraform infrastructure", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a URL shortener service using Azure Functions that creates short links and redirects users to the original URL and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);
  });

  // Terraform - Azure Container Apps
  describe("terraform-azure-container-apps-deploy", () => {
    test("creates containerized web application with Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a containerized web application and deploy to Azure Container Apps using Terraform infrastructure in my current subscription in swedencentral region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);

    test("creates simple containerized Node.js app with Terraform", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using Terraform infrastructure in my current subscription in swedencentral region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);

    test("creates social media application with Terraform infrastructure", async () => {
      await withTestResult(async () => {
        let workspacePath: string | undefined;

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
          },
          prompt: "Create a simple social media application with likes and comments and deploy to Azure using Terraform infrastructure in my current subscription in swedencentral region.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(workspacePath).toBeDefined();
        expect(containsDeployLinks).toBe(true);
        expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
      });
    }, deployTestTimeoutMs);
  });

  describe("brownfield-dotnet", () => {
    test("deploys eShop", async () => {
      await withTestResult(async () => {
        const ESHOP_REPO = "https://github.com/dotnet/eShop.git";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ESHOP_REPO,
              targetDir: workspace,
              depth: 1,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys MvcMovie 90", async () => {
      await withTestResult(async () => {
        const ASPNETCORE_DOCS_REPO = "https://github.com/dotnet/AspNetCore.Docs.git";
        const MVCMOVIE90_SPARSE_PATH = "aspnetcore/tutorials/first-mvc-app/start-mvc/sample/MvcMovie90";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPNETCORE_DOCS_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: MVCMOVIE90_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the westus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${MVCMOVIE90_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire azure functions", async () => {
      await withTestResult(async () => {
        const ASPIRE_FUNCTIONS_SPARSE_PATH = "samples/aspire-with-azure-functions";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: ASPIRE_FUNCTIONS_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${ASPIRE_FUNCTIONS_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire client apps integration", async () => {
      await withTestResult(async () => {
        const CLIENT_APPS_SPARSE_PATH = "samples/client-apps-integration";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: CLIENT_APPS_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${CLIENT_APPS_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire container build", async () => {
      await withTestResult(async () => {
        const CONTAINER_BUILD_SPARSE_PATH = "samples/container-build";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: CONTAINER_BUILD_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${CONTAINER_BUILD_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("does not deploy aspire custom resources", async () => {
      await withTestResult(async () => {
        const CUSTOM_RESOURCES_SPARSE_PATH = "samples/custom-resources";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: CUSTOM_RESOURCES_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${CUSTOM_RESOURCES_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: ["Stop if there is no further work; otherwise go with recommended options."],
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(false); //should not deploy
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire database containers", async () => {
      await withTestResult(async () => {
        const DATABASE_CONTAINERS_SPARSE_PATH = "samples/database-containers";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: DATABASE_CONTAINERS_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${DATABASE_CONTAINERS_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("does not deploy aspire health-checks-ui", async () => {
      await withTestResult(async () => {
        const HEALTH_CHECKS_SPARSE_PATH = "samples/health-checks-ui";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: HEALTH_CHECKS_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${HEALTH_CHECKS_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        // This app contains custom Aspire resource types that Azure Developer CLI cannot deploy to Azure.
        expect(containsDeployLinks).toBe(false); //should not deploy
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire orleans-voting", async () => {
      await withTestResult(async () => {
        const ORLEANS_VOTING_SPARSE_PATH = "samples/orleans-voting";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: ORLEANS_VOTING_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${ORLEANS_VOTING_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        softCheckContainerDeployEnvVars(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);
  });

  describe("brownfield-javascript", () => {
    test("deploys nodejs-demoapp", async () => {
      await withTestResult(async () => {
        const NODEJS_DEMOAPP_REPO = "https://github.com/benc-uk/nodejs-demoapp.git";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: NODEJS_DEMOAPP_REPO,
              targetDir: workspace,
              depth: 1,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire with javascript", async () => {
      await withTestResult(async () => {
        const ASPIRE_JAVASCRIPT_SPARSE_PATH = "samples/aspire-with-javascript";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: ASPIRE_JAVASCRIPT_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${ASPIRE_JAVASCRIPT_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire with node", async () => {
      await withTestResult(async () => {
        const ASPIRE_NODE_SPARSE_PATH = "samples/aspire-with-node";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: ASPIRE_NODE_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${ASPIRE_NODE_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);
  });

  describe("brownfield-python", () => {
    test("deploys flask calculator", async () => {
      await withTestResult(async () => {
        const FLASK_CALCULATOR_REPO = "https://github.com/UltiRequiem/flask-calculator.git";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: FLASK_CALCULATOR_REPO,
              targetDir: workspace,
              depth: 1,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs.",
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);

    test("deploys aspire with python", async () => {
      await withTestResult(async () => {
        const ASPIRE_PYTHON_SPARSE_PATH = "samples/aspire-with-python";

        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            await cloneRepo({
              repoUrl: ASPIRE_SAMPLES_REPO,
              targetDir: workspace,
              depth: 1,
              sparseCheckoutPath: ASPIRE_PYTHON_SPARSE_PATH,
            });
          },
          prompt:
            "Please deploy this application to Azure. " +
            "Use the eastus2 region. " +
            "Use my current subscription. " +
            "This is for a small scale production environment. " +
            "Use standard SKUs. " +
            `The app can be found under ${ASPIRE_PYTHON_SPARSE_PATH}.`,
          systemPrompt: pseudoRandomResourceGroupNameSystemPromptModifier,
          nonInteractive: true,
          followUp: FOLLOW_UP_PROMPT,
          shouldEarlyTerminate: shouldEarlyTerminateForCompletedDeployment
        });

        softCheckDeploySkills(agentMetadata);
        const containsDeployLinks = hasDeployLinks(agentMetadata);

        expect(containsDeployLinks).toBe(true);
      });
    }, brownfieldTestTimeoutMs);
  });
});
