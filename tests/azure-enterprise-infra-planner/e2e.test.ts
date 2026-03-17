/**
 * End-to-End Tests for azure-enterprise-infra-planner
 *
 * Tests the full prompt → plan → IaC generation flow with deterministic
 * structural assertions. Every check validates types, existence, shapes,
 * and formats — no subjective quality grading.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import * as fs from "fs";
import * as path from "path";
import {
  useAgentRunner,
  shouldSkipIntegrationTests,
  getIntegrationSkipReason
} from "../utils/agent-runner";
import { softCheckSkill, listFilesRecursive } from "../utils/evaluate";

const SKILL_NAME = "azure-enterprise-infra-planner";
const FOLLOW_UP_DEFAULTS = ["Go with recommended options. Assume all defaults to make the plan."];

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping e2e tests: ${skipReason}`);
}

const describeE2E = skipTests ? describe.skip : describe;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface InfrastructurePlan {
  meta?: {
    planId?: unknown;
    generatedAt?: unknown;
    version?: unknown;
    status?: unknown;
  };
  inputs?: {
    userGoal?: unknown;
    subGoals?: unknown;
  };
  plan?: {
    resources?: Array<{
      name?: unknown;
      type?: unknown;
      location?: unknown;
      sku?: unknown;
      properties?: unknown;
      reasoning?: {
        whyChosen?: unknown;
        alternativesConsidered?: unknown;
        tradeoffs?: unknown;
      };
      dependencies?: unknown[];
      dependencyReasoning?: unknown;
      references?: unknown[];
    }>;
    overallReasoning?: unknown;
    architecturePrinciples?: unknown;
    validation?: unknown;
    references?: unknown[];
  };
}

/**
 * Read and parse infrastructure-plan.json from the workspace.
 * Searches .azure/ first (canonical), then workspace root, then recursively.
 */
function findAndParsePlan(workspacePath: string): { plan: InfrastructurePlan; filePath: string } | null {
  // Canonical path
  const canonicalPath = path.join(workspacePath, ".azure", "infrastructure-plan.json");
  if (fs.existsSync(canonicalPath)) {
    return { plan: JSON.parse(fs.readFileSync(canonicalPath, "utf-8")), filePath: canonicalPath };
  }

  // Search recursively for infrastructure-plan.json
  const allFiles = listFilesRecursive(workspacePath);
  const planFile = allFiles.find(f => f.endsWith("infrastructure-plan.json"));
  if (planFile) {
    return { plan: JSON.parse(fs.readFileSync(planFile, "utf-8")), filePath: planFile };
  }

  return null;
}

/**
 * Standard setup: pre-create .azure/ directory.
 */
function setupAzureDir(workspace: string): void {
  fs.mkdirSync(path.join(workspace, ".azure"), { recursive: true });
}

/**
 * Standard setup: pre-create .azure/ and infra/modules/ directories.
 */
function setupAzureAndInfraDir(workspace: string): void {
  fs.mkdirSync(path.join(workspace, ".azure"), { recursive: true });
  fs.mkdirSync(path.join(workspace, "infra", "modules"), { recursive: true });
}

/**
 * Guard for SDK load failures — returns true if test should be skipped.
 */
function isSdkLoadError(e: unknown): boolean {
  return e instanceof Error && !!e.message?.includes("Failed to load @github/copilot-sdk");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describeE2E(`${SKILL_NAME} - E2E Tests`, () => {
  const agent = useAgentRunner();

  describe("plan-schema-validation", () => {
    test("generated plan has all required top-level schema fields", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Plan infrastructure for a microservices app with Service Bus and Key Vault. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        // meta
        expect(plan).toHaveProperty("meta");
        expect(typeof plan.meta?.planId).toBe("string");
        expect(typeof plan.meta?.generatedAt).toBe("string");
        expect(typeof plan.meta?.version).toBe("string");
        expect(typeof plan.meta?.status).toBe("string");

        // inputs
        expect(plan).toHaveProperty("inputs");
        expect(typeof plan.inputs?.userGoal).toBe("string");
        expect((plan.inputs?.userGoal as string).length).toBeGreaterThan(0);

        // plan
        expect(plan).toHaveProperty("plan");
        expect(plan.plan).toHaveProperty("resources");
        expect(Array.isArray(plan.plan?.resources)).toBe(true);
        expect(plan.plan!.resources!.length).toBeGreaterThan(0);

        // plan-level fields
        expect(plan.plan).toHaveProperty("overallReasoning");
        expect(plan.plan).toHaveProperty("architecturePrinciples");
        expect(Array.isArray(plan.plan?.architecturePrinciples)).toBe(true);
        expect(typeof plan.plan?.validation).toBe("string");
        expect(Array.isArray(plan.plan?.references)).toBe(true);

        console.log(`✅ Plan schema valid — ${plan.plan!.resources!.length} resources, status: ${plan.meta?.status}`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("resource-structure-validation", () => {
    test("every resource has required fields with correct types", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Set up a hub-spoke network with VPN Gateway, Azure Firewall, and Bastion. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        const resources = plan.plan?.resources ?? [];
        expect(resources.length).toBeGreaterThan(0);

        for (const resource of resources) {
          // Required string fields
          expect(typeof resource.name).toBe("string");
          expect((resource.name as string).length).toBeGreaterThan(0);

          expect(typeof resource.type).toBe("string");
          expect((resource.type as string).length).toBeGreaterThan(0);

          expect(typeof resource.location).toBe("string");
          expect((resource.location as string).length).toBeGreaterThan(0);

          expect(typeof resource.sku).toBe("string");

          // Required arrays
          expect(Array.isArray(resource.dependencies)).toBe(true);
          expect(Array.isArray(resource.references)).toBe(true);

          // Reasoning object
          expect(resource.reasoning).toBeDefined();
          expect(typeof resource.reasoning?.whyChosen).toBe("string");
          expect(Array.isArray(resource.reasoning?.alternativesConsidered)).toBe(true);
          expect(typeof resource.reasoning?.tradeoffs).toBe("string");
        }

        console.log(`✅ All ${resources.length} resources have valid structure`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("dependency-integrity", () => {
    test("all dependency references resolve and no self-references exist", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Provision a 3-tier app with VNet, subnets, NSGs, and internal Load Balancer. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        const resources = plan.plan?.resources ?? [];
        expect(resources.length).toBeGreaterThan(0);

        const resourceNames = new Set(resources.map(r => r.name as string));

        // No duplicate names
        expect(resourceNames.size).toBe(resources.length);

        for (const resource of resources) {
          const deps = (resource.dependencies ?? []) as string[];
          for (const dep of deps) {
            // Every dependency must reference an existing resource
            expect(resourceNames.has(dep)).toBe(true);
            // No self-references
            expect(dep).not.toBe(resource.name);
          }
        }

        const totalDeps = resources.reduce((sum, r) => sum + ((r.dependencies as string[]) ?? []).length, 0);
        console.log(`✅ Dependency integrity: ${resources.length} resources, ${totalDeps} dependency links, all valid`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("arm-type-format", () => {
    test("every resource type matches ARM type format", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Deploy Azure SQL with Key Vault for encryption keys, Storage Account for backups, and Log Analytics for monitoring. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        const resources = plan.plan?.resources ?? [];
        expect(resources.length).toBeGreaterThan(0);

        const armTypePattern = /^Microsoft\.\w[\w.]*\/\w[\w.]*$/;

        for (const resource of resources) {
          const resourceType = resource.type as string;
          expect(resourceType).toBeDefined();
          expect(resourceType.length).toBeGreaterThan(0);
          expect(armTypePattern.test(resourceType)).toBe(true);
        }

        const types = resources.map(r => r.type);
        console.log(`✅ All ${resources.length} ARM types well-formed: ${types.join(", ")}`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("bicep-generation", () => {
    test("generates Bicep files with valid content after plan approval", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Plan infrastructure for an IoT solution with Event Hub, Stream Analytics, and Cosmos DB. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: [
            ...FOLLOW_UP_DEFAULTS,
            "Looks good! Generate Bicep now."
          ],
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureAndInfraDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const allFiles = listFilesRecursive(testWorkspacePath!);
        const bicepFiles = allFiles.filter(f => f.endsWith(".bicep"));

        expect(bicepFiles.length).toBeGreaterThan(0);

        // Verify Bicep files contain valid content keywords
        const bicepKeywords = /\b(resource|module|param|var|output|targetScope)\b/;
        for (const bicepFile of bicepFiles) {
          const content = fs.readFileSync(bicepFile, "utf-8");
          expect(content.length).toBeGreaterThan(0);
          expect(bicepKeywords.test(content)).toBe(true);
        }

        // Soft check: files should be under infra/
        const infraDir = path.join(testWorkspacePath!, "infra");
        const infraBicepFiles = bicepFiles.filter(f =>
          path.normalize(f).startsWith(path.normalize(infraDir))
        );

        if (infraBicepFiles.length === 0) {
          const misplaced = bicepFiles.map(f => path.relative(testWorkspacePath!, f));
          console.warn(`⚠️  Bicep files generated outside infra/: [${misplaced.join(", ")}]`);
        } else {
          console.log(`✅ ${infraBicepFiles.length} Bicep file(s) under infra/`);
        }

        console.log(`✅ Bicep generation: ${bicepFiles.length} files with valid content`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("terraform-generation", () => {
    test("generates Terraform files with valid content after plan approval", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Plan infrastructure for a batch processing pipeline with VMs, Storage, and Azure Automation. Use Terraform. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: [
            ...FOLLOW_UP_DEFAULTS,
            "Generate Terraform now."
          ],
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureAndInfraDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const allFiles = listFilesRecursive(testWorkspacePath!);
        const tfFiles = allFiles.filter(f => f.endsWith(".tf"));

        expect(tfFiles.length).toBeGreaterThan(0);

        // Verify Terraform files contain valid content keywords
        const tfKeywords = /\b(resource|module|variable|output|provider|terraform|data|locals)\b/;
        for (const tfFile of tfFiles) {
          const content = fs.readFileSync(tfFile, "utf-8");
          expect(content.length).toBeGreaterThan(0);
          expect(tfKeywords.test(content)).toBe(true);
        }

        // Soft check: files should be under infra/
        const infraDir = path.join(testWorkspacePath!, "infra");
        const infraTfFiles = tfFiles.filter(f =>
          path.normalize(f).startsWith(path.normalize(infraDir))
        );

        if (infraTfFiles.length === 0) {
          const misplaced = tfFiles.map(f => path.relative(testWorkspacePath!, f));
          console.warn(`⚠️  Terraform files generated outside infra/: [${misplaced.join(", ")}]`);
        } else {
          console.log(`✅ ${infraTfFiles.length} Terraform file(s) under infra/`);
        }

        console.log(`✅ Terraform generation: ${tfFiles.length} files with valid content`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("plan-status-lifecycle", () => {
    test("plan status is draft on initial generation", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Architect a landing zone with hub VNet, Azure Firewall, and VPN Gateway. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        expect(plan.meta?.status).toBe("draft");

        console.log("✅ Plan status is \"draft\" as expected");
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("plan-inputs-capture", () => {
    test("plan inputs contain a non-empty user goal", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Design a disaster recovery topology across East US and West US with VM replication and automated failover. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        expect(plan).toHaveProperty("inputs");
        expect(typeof plan.inputs?.userGoal).toBe("string");
        expect((plan.inputs!.userGoal as string).length).toBeGreaterThan(0);

        console.log(`✅ Plan inputs captured — userGoal: "${(plan.inputs!.userGoal as string).substring(0, 80)}..."`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("multi-resource-count", () => {
    test("complex prompt produces multiple resources with unique names", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Set up a secure web app with App Gateway, WAF, Key Vault, Managed Identity, VNet, and SQL Database. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();
        const result = findAndParsePlan(testWorkspacePath!);
        expect(result).not.toBeNull();
        const { plan } = result!;

        const resources = plan.plan?.resources ?? [];
        // Prompt explicitly names 6 resources, agent should plan at least 3+
        expect(resources.length).toBeGreaterThan(3);

        // Unique names
        const names = resources.map(r => r.name as string);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(names.length);

        console.log(`✅ ${resources.length} resources planned, all with unique names`);
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });

  describe("plan-file-location", () => {
    test("plan file is created at .azure/infrastructure-plan.json", async () => {
      let testWorkspacePath: string | undefined;

      try {
        const agentMetadata = await agent.run({
          prompt: "Plan Azure infrastructure for a data analytics pipeline with Data Factory and Synapse. Assume all defaults to make the plan.",
          nonInteractive: true,
          followUp: FOLLOW_UP_DEFAULTS,
          preserveWorkspace: true,
          includeSkills: [SKILL_NAME],
          setup: async (workspace: string) => {
            testWorkspacePath = workspace;
            setupAzureDir(workspace);
          }
        });

        softCheckSkill(agentMetadata, SKILL_NAME);

        expect(testWorkspacePath).toBeDefined();

        // Canonical location
        const canonicalPath = path.join(testWorkspacePath!, ".azure", "infrastructure-plan.json");
        const allFiles = listFilesRecursive(testWorkspacePath!);
        const planFiles = allFiles.filter(f => f.endsWith("infrastructure-plan.json"));

        expect(planFiles.length).toBeGreaterThan(0);

        if (fs.existsSync(canonicalPath)) {
          console.log("✅ Plan file at canonical location: .azure/infrastructure-plan.json");
        } else {
          const locations = planFiles.map(f => path.relative(testWorkspacePath!, f));
          console.warn(`⚠️  Plan file not at .azure/infrastructure-plan.json. Found at: [${locations.join(", ")}]`);
        }

        // Verify it's valid JSON regardless of location
        const planContent = fs.readFileSync(planFiles[0], "utf-8");
        const parsed = JSON.parse(planContent);
        expect(parsed).toHaveProperty("meta");
        expect(parsed).toHaveProperty("plan");

        console.log("✅ Plan file is valid JSON");
      } catch (e: unknown) {
        if (isSdkLoadError(e)) { console.log("⏭️  SDK not loadable, skipping"); return; }
        throw e;
      }
    });
  });
});
