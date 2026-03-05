/**
 * Unit Tests for azure-kubernetes
 *
 * Tests domain invariants - concepts that should always be present
 * in AKS cluster planning guidance.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes";

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

    test("description mentions AKS or Kubernetes", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/aks|kubernetes/);
    });
  });

  describe("Day-0 vs Day-1 Guidance", () => {
    test("distinguishes Day-0 decisions from Day-1 features", () => {
      expect(skill.content).toContain("Day-0");
      expect(skill.content).toContain("Day-1");
    });

    test("identifies networking as hard-to-change decision", () => {
      const content = skill.content.toLowerCase();
      // Networking is a Day-0 decision that's hard to change after cluster creation
      expect(content).toMatch(/network|cni|pod ip/i);
    });
  });

  describe("Cluster SKU Guidance", () => {
    test("covers AKS Automatic vs Standard choice", () => {
      expect(skill.content).toContain("Automatic");
      expect(skill.content).toContain("Standard");
    });

    test("recommends AKS Automatic as default for most workloads", () => {
      const content = skill.content.toLowerCase();
      // AKS Automatic should be the recommended default
      expect(content).toMatch(/automatic.*default|default.*automatic/);
    });
  });

  describe("Networking Guidance", () => {
    test("covers pod IP model options", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/overlay|vnet|cni/);
    });

    test("mentions egress configuration", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/egress|outbound/);
    });

    test("mentions ingress options", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/ingress|gateway/);
    });
  });

  describe("Security Guidance", () => {
    test("recommends Entra ID / managed identity", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/entra|workload identity|managed identity/);
    });

    test("mentions secrets management", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/key vault|secret/);
    });

    test("mentions policy or governance", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/policy|safeguard|governance/);
    });
  });

  describe("Observability Guidance", () => {
    test("mentions monitoring or observability", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/monitor|observ|prometheus|grafana|insights/);
    });
  });

  describe("Reliability & Upgrades", () => {
    test("mentions availability zones", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/zone|az\b/);
    });

    test("covers upgrade strategy", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/upgrade|patch|maintenance/);
    });
  });
});