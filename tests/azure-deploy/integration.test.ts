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
  isSkillInvoked,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner
} from "../utils/agent-runner";
import * as fs from "fs";
import { hasDeployLinks, softCheckDeploySkills, expectFiles } from "./utils";
import { cloneRepo } from "../utils/git-clone";

const SKILL_NAME = "azure-deploy";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate
const ASPIRE_SAMPLES_REPO = "https://github.com/dotnet/aspire-samples.git";

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

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
  const agent = useAgentRunner();
  describe("skill-invocation", () => {
    test("invokes azure-deploy skill for deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Run azd up to deploy my already-prepared app to Azure"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-deploy skill for publish to Azure prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Publish my web app to Azure and configure the environment"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for publish prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for publish prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });

    test("invokes azure-deploy skill for Azure Functions deployment prompt", async () => {
      let successCount = 0;

      for (let i = 0; i < RUNS_PER_PROMPT; i++) {
        try {
          const agentMetadata = await agent.run({
            prompt: "Deploy my Azure Functions app to the cloud using azd"
          });

          if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
            successCount++;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
            console.log("⏭️  SDK not loadable, skipping test");
            return;
          }
          throw e;
        }
      }

      const invocationRate = successCount / RUNS_PER_PROMPT;
      console.log(`${SKILL_NAME} invocation rate for Functions deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`);
      fs.appendFileSync(`./result-${SKILL_NAME}.txt`, `${SKILL_NAME} invocation rate for Functions deployment prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`);
      expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
    });
  });

  // Need to be logged into azd for these tests. 
  // azd auth login
  const FOLLOW_UP_PROMPT = ["Go with recommended options."];
  // Static Web Apps (SWA)
  describe("static-web-apps-deploy", () => {
    test("creates whiteboard application", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a static whiteboard web app and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    test("creates static portfolio website", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a static portfolio website and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates static portfolio website with Terraform infrastructure", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a static portfolio website and deploy to Azure Static Web Apps using Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
    }, deployTestTimeoutMs);
  });

  // App Service
  describe("app-service-deploy", () => {
    test("creates discussion board", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a discussion board application and deploy to Azure App Service using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);
      
      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    test("creates todo list with frontend and API", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a todo list with frontend and API and deploy to Azure App Service using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates todo list with frontend and API using Terraform", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a todo list with frontend and API and deploy to Azure App Service using Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
    }, deployTestTimeoutMs);
  });

  // Azure Functions
  describe("azure-functions-deploy", () => {
    test("creates serverless HTTP API", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a serverless HTTP API using Azure Functions and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);
      
      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    test("creates event-driven function app", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create an event-driven function app to process messages and deploy to Azure Functions using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates URL shortener service with Terraform infrastructure", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a URL shortener service using Azure Functions that creates short links and redirects users to the original URL and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
    }, deployTestTimeoutMs);

    test("creates Python function app with Service Bus trigger", async () => {
      const agentMetadata = await agent.run({
        prompt: "Create an azure python function app that takes input from a service bus trigger and does message processing and deploy to Azure using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT
      });

      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
      const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(isSkillUsed).toBe(true);
      expect(isValidateInvoked).toBe(true);
      expect(isPrepareInvoked).toBe(true);
      expect(containsDeployLinks).toBe(true);
    }, deployTestTimeoutMs);
  });

  // Azure Container Apps (ACA)
  describe("azure-container-apps-deploy", () => {
    test("creates containerized web application", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a containerized web application and deploy to Azure Container Apps using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    test("creates simple containerized Node.js app", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a simple containerized Node.js hello world app and deploy to Azure Container Apps using my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.bicep$/], [/\.tf$/]);
    }, deployTestTimeoutMs);

    // Terraform test
    test("creates social media application with Terraform infrastructure", async () => {
      let workspacePath: string | undefined;

      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
        },
        prompt: "Create a simple social media application with likes and comments and deploy to Azure using Terraform infrastructure in my current subscription in eastus2 region.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
        preserveWorkspace: true
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(workspacePath).toBeDefined();
      expect(containsDeployLinks).toBe(true);
      expectFiles(workspacePath!, [/infra\/.*\.tf$/], [/\.bicep$/]);
    }, deployTestTimeoutMs);
  });

  describe("brownfield-dotnet", () => {
    test("deploys eShop", async () => {
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
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys MvcMovie 90", async () => {
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
          "Use the eastus2 region. " +
          "Use my current subscription. " +
          "This is for a small scale production environment. " +
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire azure functions", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire client apps integration", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire container build", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("does not deploy aspire custom resources", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(false); //should not deploy
    }, brownfieldTestTimeoutMs);

    test("deploys aspire database containers", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);
      
      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire health-checks-ui", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire orleans-voting", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);  
  });

  describe("brownfield-javascript", () => {
    test("deploys nodejs-demoapp", async () => {
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
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire with javascript", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire with node", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);
  });

  describe("brownfield-python", () => {
    test("deploys flask calculator", async () => {
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
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });

      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);

    test("deploys aspire with python", async () => {
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
          "Use standard SKUs.",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
  
      softCheckDeploySkills(agentMetadata);
      const containsDeployLinks = hasDeployLinks(agentMetadata);

      expect(containsDeployLinks).toBe(true);
    }, brownfieldTestTimeoutMs);
  });
});
