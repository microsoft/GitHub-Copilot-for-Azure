/**
 * Unit Tests for azure-local
 *
 * Tests the Azure Local router skill, workflows, and reference files.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-local";

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

    test("description contains Azure Local trigger phrases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
      expect(description).toContain("azure local");
      expect(description).toContain("stack hci");
    });
  });

  describe("Skill Content", () => {
    test("routes to all Azure Local workflow files", () => {
      expect(skill.content).toContain("workflows/plan-and-deploy/plan-and-deploy.md");
      expect(skill.content).toContain("workflows/operate-and-update/operate-and-update.md");
      expect(skill.content).toContain("workflows/workload-management/workload-management.md");
      expect(skill.content).toContain("workflows/networking-and-security/networking-and-security.md");
      expect(skill.content).toContain("workflows/troubleshooting/troubleshooting.md");
    });

    test("links required shared references", () => {
      expect(skill.content).toContain("references/docs-map.md");
      expect(skill.content).toContain("references/mcp-and-cli-tools.md");
      expect(skill.content).toContain("references/safety-rules.md");
      expect(skill.content).toContain("references/resource-types.md");
    });

    test("uses safe defaults before mutations", () => {
      expect(skill.content).toContain("Start read-only");
      expect(skill.content).toContain("Ask before updates");
      expect(skill.content).toContain("Do not use for cloud VM or public AKS guidance");
    });
  });

  describe("Workflow Files", () => {
    const workflowFiles = [
      "workflows/plan-and-deploy/plan-and-deploy.md",
      "workflows/operate-and-update/operate-and-update.md",
      "workflows/workload-management/workload-management.md",
      "workflows/networking-and-security/networking-and-security.md",
      "workflows/troubleshooting/troubleshooting.md",
    ];

    test.each(workflowFiles)("%s exists and has substantive content", async (relativePath) => {
      const content = await fs.readFile(path.join(SKILLS_PATH, SKILL_NAME, relativePath), "utf-8");
      expect(content.length).toBeGreaterThan(1000);
      expect(content).toContain("docs-map");
      expect(content).toContain("safety-rules");
    });
  });

  describe("Reference Files", () => {
    test("documents partial Azure MCP compatibility instead of a dedicated Azure Local MCP tool", async () => {
      const content = await fs.readFile(
        path.join(SKILLS_PATH, SKILL_NAME, "references/mcp-and-cli-tools.md"),
        "utf-8"
      );
      expect(content).toContain("does not currently expose a dedicated Azure Local tool namespace");
      expect(content).toContain("Azure Resource Graph");
      expect(content).toContain("Microsoft.AzureStackHCI/clusters");
    });

    test("documents Azure Local resource types and ARG query rules", async () => {
      const content = await fs.readFile(
        path.join(SKILLS_PATH, SKILL_NAME, "references/resource-types.md"),
        "utf-8"
      );
      expect(content).toContain("microsoft.azurestackhci/clusters");
      expect(content).toContain("microsoft.resourceconnector/appliances");
      expect(content).toContain("microsoft.extendedlocation/customlocations");
      expect(content).toContain("```kql");
      expect(content).toContain("Do not mutate through ARG");
    });

    test("documents destructive operation guardrails", async () => {
      const content = await fs.readFile(
        path.join(SKILLS_PATH, SKILL_NAME, "references/safety-rules.md"),
        "utf-8"
      );
      expect(content).toContain("Always ask before");
      expect(content).toContain("Deleting, recreating, or repairing Azure Arc resource bridge");
      expect(content).toContain("Installing, scheduling, importing, or retrying updates");
    });
  });
});
