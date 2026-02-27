/**
 * Unit Tests for microsoft-foundry
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
      // Descriptions should be 150-1024 chars for Medium-High compliance
      expect(skill.metadata.description.length).toBeGreaterThan(150);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test("description contains USE FOR triggers", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/USE FOR:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      const description = skill.metadata.description;
      expect(description).toMatch(/DO NOT USE FOR:/i);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(skill.content).toContain("## Agent Development Lifecycle");
      expect(skill.content).toContain("## Sub-Skills");
      expect(skill.content).toContain("## Agent: Project Context Resolution");
      expect(skill.content).toContain("## Agent: Agent Types");
    });

    test("contains agent routing references", () => {
      expect(skill.content).toContain("deploy");
      expect(skill.content).toContain("invoke");
      expect(skill.content).toContain("troubleshoot");
    });

    test("contains common project context resolution", () => {
      expect(skill.content).toContain("azure.yaml");
      expect(skill.content).toContain("azd env get-values");
    });

    test("documents azd variable mapping", () => {
      expect(skill.content).toContain("AZURE_AI_PROJECT_ENDPOINT");
      expect(skill.content).toContain("AZURE_CONTAINER_REGISTRY_NAME");
    });
  });

  describe("Sub-Skills Reference", () => {
    test("has Sub-Skills table", () => {
      expect(skill.content).toContain("## Sub-Skills");
    });

    test("references agent sub-skills in table", () => {
      expect(skill.content).toContain("foundry-agent/deploy/deploy.md");
      expect(skill.content).toContain("foundry-agent/invoke/invoke.md");
      expect(skill.content).toContain("foundry-agent/troubleshoot/troubleshoot.md");
    });

    test("references quota sub-skill", () => {
      expect(skill.content).toContain("quota");
      expect(skill.content).toContain("quota/quota.md");
    });

    test("references rbac sub-skill", () => {
      expect(skill.content).toContain("rbac");
      expect(skill.content).toContain("rbac/rbac.md");
    });
  });

  describe("Quota Sub-Skill Content", () => {
    let quotaContent: string;

    beforeAll(async () => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const quotaPath = path.join(
        SKILLS_PATH,
        "microsoft-foundry/quota/quota.md"
      );
      quotaContent = await fs.readFile(quotaPath, "utf-8");
    });

    test("has quota reference file", () => {
      expect(quotaContent).toBeDefined();
      expect(quotaContent.length).toBeGreaterThan(100);
    });

    test("contains quota management workflows", () => {
      expect(quotaContent).toContain("### 1. Check Regional Quota");
      expect(quotaContent).toContain("### 2. Find Best Region for Deployment");
      expect(quotaContent).toContain("### 3. Deploy with PTU");
      expect(quotaContent).toContain("### 4. Delete Deployment (Free Quota)");
    });

    test("contains command patterns for each workflow", () => {
      expect(quotaContent).toContain("Show my Microsoft Foundry quota usage");
      expect(quotaContent).toContain("Request quota increase");
    });

    test("contains az cognitiveservices commands", () => {
      expect(quotaContent).toContain("az rest");
      expect(quotaContent).toContain("az cognitiveservices account deployment");
    });

    test("contains error troubleshooting", () => {
      expect(quotaContent).toContain("QuotaExceeded");
      expect(quotaContent).toContain("InsufficientQuota");
      expect(quotaContent).toContain("DeploymentLimitReached");
    });

    test("includes quota management guidance", () => {
      expect(quotaContent).toContain("## Core Workflows");
    });

    test("contains bash command examples", () => {
      expect(quotaContent).toContain("```bash");
      expect(quotaContent).toContain("az rest");
    });
  });

  describe("RBAC Sub-Skill Content", () => {
    let rbacContent: string;

    beforeAll(async () => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const rbacPath = path.join(
        SKILLS_PATH,
        "microsoft-foundry/rbac/rbac.md"
      );
      rbacContent = await fs.readFile(rbacPath, "utf-8");
    });

    test("has RBAC reference file", () => {
      expect(rbacContent).toBeDefined();
      expect(rbacContent.length).toBeGreaterThan(100);
    });

    test("contains Azure AI Foundry roles table", () => {
      expect(rbacContent).toContain("Azure AI User");
      expect(rbacContent).toContain("Azure AI Project Manager");
      expect(rbacContent).toContain("Azure AI Account Owner");
      expect(rbacContent).toContain("Azure AI Owner");
    });

    test("contains roles capability matrix", () => {
      expect(rbacContent).toContain("Create Projects");
      expect(rbacContent).toContain("Data Actions");
      expect(rbacContent).toContain("Role Assignments");
    });

    test("contains Portal vs SDK/CLI warning", () => {
      expect(rbacContent).toMatch(/portal.*but.*not.*sdk|cli/i);
    });

    test("contains all 6 RBAC workflows", () => {
      expect(rbacContent).toContain("### 1. Assign User Permissions");
      expect(rbacContent).toContain("### 2. Assign Developer Permissions");
      expect(rbacContent).toContain("### 3. Audit Role Assignments");
      expect(rbacContent).toContain("### 4. Validate Permissions");
      expect(rbacContent).toContain("### 5. Configure Managed Identity Roles");
      expect(rbacContent).toContain("### 6. Create Service Principal");
    });

    test("contains az role assignment commands", () => {
      expect(rbacContent).toContain("az role assignment create");
      expect(rbacContent).toContain("az role assignment list");
    });

    test("contains az ad sp commands for service principal", () => {
      expect(rbacContent).toContain("az ad sp create-for-rbac");
    });

    test("contains managed identity roles for connected resources", () => {
      expect(rbacContent).toContain("Storage Blob Data Reader");
      expect(rbacContent).toContain("Storage Blob Data Contributor");
      expect(rbacContent).toContain("Key Vault Secrets User");
      expect(rbacContent).toContain("Search Index Data Reader");
      expect(rbacContent).toContain("Search Index Data Contributor");
    });

    test("uses correct Foundry resource type", () => {
      expect(rbacContent).toContain("Microsoft.CognitiveServices/accounts");
    });

    test("contains permission requirements table", () => {
      expect(rbacContent).toContain("Permission Requirements by Action");
      expect(rbacContent).toContain("Deploy models");
      expect(rbacContent).toContain("Create projects");
    });

    test("contains error handling section", () => {
      expect(rbacContent).toContain("Error Handling");
      expect(rbacContent).toContain("Authorization failed");
    });

    test("contains bash command examples", () => {
      expect(rbacContent).toContain("```bash");
    });
  });
});
