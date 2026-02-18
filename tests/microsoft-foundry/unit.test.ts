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
      expect(skill.content).toContain("## Core Workflows");
      expect(skill.content).toContain("## Prerequisites");
      expect(skill.content).toContain("## Quick Reference");
    });

    test("contains MCP tool references", () => {
      expect(skill.content).toContain("foundry_");
    });
  });

  describe("Sub-Skills Reference", () => {
    test("has Sub-Skills table", () => {
      expect(skill.content).toContain("## Sub-Skills");
    });

    test("references foundry-agent sub-skill", () => {
      expect(skill.content).toContain("foundry-agent");
      expect(skill.content).toContain("foundry-agent/SKILL.md");
    });

    test("references foundry-agent sub-skill in table", () => {
      expect(skill.content).toContain("foundry-agent");
      expect(skill.content).toContain("Create, package, deploy, invoke, debug, logs");
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
      expect(quotaContent).toContain("### 1. View Current Quota Usage");
      expect(quotaContent).toContain("### 2. Find Best Region for Model Deployment");
      expect(quotaContent).toContain("### 3. Check Quota Before Deployment");
      expect(quotaContent).toContain("### 4. Request Quota Increase");
      expect(quotaContent).toContain("### 5. Monitor Quota Across Deployments");
      expect(quotaContent).toContain("### 6. Deploy with Provisioned Throughput Units (PTU)");
      expect(quotaContent).toContain("### 7. Troubleshoot Quota Errors");
    });

    test("explains quota types", () => {
      expect(quotaContent).toContain("Deployment Quota (TPM)");
      expect(quotaContent).toContain("Region Quota");
      expect(quotaContent).toContain("Deployment Slots");
    });

    test("contains command patterns for each workflow", () => {
      expect(quotaContent).toContain("Show my Microsoft Foundry quota usage");
      expect(quotaContent).toContain("Do I have enough quota");
      expect(quotaContent).toContain("Request quota increase");
      expect(quotaContent).toContain("Show all my Foundry deployments");
    });

    test("contains az cognitiveservices commands", () => {
      expect(quotaContent).toContain("az rest");
      expect(quotaContent).toContain("az cognitiveservices account deployment");
    });

    test("references foundry MCP tools", () => {
      expect(quotaContent).toContain("foundry_models_deployments_list");
      expect(quotaContent).toMatch(/foundry_[a-z_]+/);
    });

    test("contains error troubleshooting", () => {
      expect(quotaContent).toContain("QuotaExceeded");
      expect(quotaContent).toContain("InsufficientQuota");
      expect(quotaContent).toContain("DeploymentLimitReached");
    });

    test("includes quota management guidance", () => {
      expect(quotaContent).toContain("## Core Workflows");
      expect(quotaContent).toContain("PTU Capacity Planning");
      expect(quotaContent).toContain("Understanding Quotas");
    });

    test("contains bash command examples", () => {
      expect(quotaContent).toContain("```bash");
      expect(quotaContent).toContain("az rest");
    });

    test("uses correct Foundry resource type", () => {
      expect(quotaContent).toContain("Microsoft.CognitiveServices/accounts");
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
      expect(rbacContent).toContain("### 1. Setup User Permissions");
      expect(rbacContent).toContain("### 2. Setup Developer Permissions");
      expect(rbacContent).toContain("### 3. Audit Role Assignments");
      expect(rbacContent).toContain("### 4. Validate Permissions");
      expect(rbacContent).toContain("### 5. Configure Managed Identity Roles");
      expect(rbacContent).toContain("### 6. Create Service Principal");
    });

    test("contains command patterns for each workflow", () => {
      expect(rbacContent).toContain("Grant Alice access to my Foundry project");
      expect(rbacContent).toContain("Make Bob a project manager");
      expect(rbacContent).toContain("Who has access to my Foundry?");
      expect(rbacContent).toContain("Can I deploy models?");
      expect(rbacContent).toContain("Set up identity for my project");
      expect(rbacContent).toContain("Create SP for CI/CD pipeline");
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
