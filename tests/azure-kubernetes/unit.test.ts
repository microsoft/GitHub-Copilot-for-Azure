/**
 * Unit Tests for azure-kubernetes
 *
 * Tests skill content and structure without requiring external services.
 * Focuses on domain invariants rather than exact formatting.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;
  let clusterConfigContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    const refPath = path.join(skill.path, "references", "cluster-configuration.md");
    clusterConfigContent = fs.readFileSync(refPath, "utf-8");
  });

  describe("Skill Metadata", () => {
    test("has required frontmatter fields", () => {
      expect(skill.metadata.name).toBe("azure-kubernetes");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(500);
    });

    test("description contains WHEN triggers", () => {
      expect(skill.metadata.description).toMatch(/WHEN:/i);
    });

    test("description contains DO NOT USE FOR anti-triggers", () => {
      expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
    });

    test("description mentions key AKS concepts", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/aks/);
      expect(desc).toMatch(/cluster|networking|security/);
    });

    test("has license field", () => {
      expect(skill.metadata.license).toBe("MIT");
    });

    test("has metadata version", () => {
      expect(skill.metadata.metadata).toBeDefined();
      expect((skill.metadata.metadata as Record<string, string>).version).toBeDefined();
    });
  });

  describe("Required Sections", () => {
    test("has Quick Reference section", () => {
      expect(skill.content).toMatch(/## Quick Reference/);
    });

    test("has When to Use This Skill section", () => {
      expect(skill.content).toMatch(/## When to Use This Skill/);
    });

    test("has MCP Tools section", () => {
      expect(skill.content).toMatch(/## MCP Tools/);
    });

    test("has Error Handling section", () => {
      expect(skill.content).toMatch(/## Error Handling/);
    });

    test("has Workflow section", () => {
      expect(skill.content).toMatch(/## Workflow/);
    });

    test("has Guardrails section", () => {
      expect(skill.content).toMatch(/## Guardrails/);
    });
  });

  describe("Day-0 vs Day-1 Guidance", () => {
    test("distinguishes between Day-0 and Day-1 decisions", () => {
      expect(skill.content).toMatch(/Day-0/i);
      expect(skill.content).toMatch(/Day-1/i);
    });

    test("identifies networking as Day-0 decision", () => {
      expect(skill.content).toMatch(/Day-0.*networking|networking.*Day-0/i);
    });

    test("identifies API server access as Day-0 consideration", () => {
      expect(skill.content).toMatch(/api server/i);
    });
  });

  describe("Cluster SKU Guidance", () => {
    test("covers AKS Automatic SKU", () => {
      expect(skill.content).toMatch(/AKS Automatic/i);
    });

    test("covers AKS Standard SKU", () => {
      expect(skill.content).toMatch(/AKS Standard/i);
    });

    test("recommends Automatic as default", () => {
      expect(skill.content).toMatch(/automatic.*default|default.*automatic/i);
    });
  });

  describe("Reference Files", () => {
    test("cluster-configuration.md exists", () => {
      const refPath = path.join(skill.path, "references", "cluster-configuration.md");
      expect(fs.existsSync(refPath)).toBe(true);
    });

    test("cli-reference.md exists", () => {
      const refPath = path.join(skill.path, "references", "cli-reference.md");
      expect(fs.existsSync(refPath)).toBe(true);
    });

    test("SKILL.md links to cluster configuration reference", () => {
      expect(skill.content).toMatch(/cluster-configuration\.md/);
    });

    test("SKILL.md links to CLI reference", () => {
      expect(skill.content).toMatch(/cli-reference\.md/);
    });
  });

  describe("Networking Guidance (reference)", () => {
    test("covers Azure CNI options", () => {
      expect(clusterConfigContent).toMatch(/Azure CNI/i);
    });

    test("covers overlay networking", () => {
      expect(clusterConfigContent).toMatch(/overlay/i);
    });

    test("covers egress patterns", () => {
      expect(clusterConfigContent).toMatch(/egress/i);
    });

    test("covers ingress options", () => {
      expect(clusterConfigContent).toMatch(/ingress/i);
    });
  });

  describe("Security Best Practices (reference)", () => {
    test("recommends Entra ID", () => {
      expect(clusterConfigContent).toMatch(/entra/i);
    });

    test("recommends Workload Identity", () => {
      expect(clusterConfigContent).toMatch(/workload identity/i);
    });

    test("recommends Key Vault integration", () => {
      expect(clusterConfigContent).toMatch(/key vault/i);
    });

    test("warns against static credentials", () => {
      expect(clusterConfigContent).toMatch(/avoid.*static|static.*credential/i);
    });

    test("mentions Azure Policy", () => {
      expect(clusterConfigContent).toMatch(/azure policy/i);
    });
  });

  describe("Observability Guidance (reference)", () => {
    test("mentions monitoring options", () => {
      expect(clusterConfigContent).toMatch(/monitor|observability/i);
    });

    test("mentions Prometheus", () => {
      expect(clusterConfigContent).toMatch(/prometheus/i);
    });

    test("mentions Grafana", () => {
      expect(clusterConfigContent).toMatch(/grafana/i);
    });
  });

  describe("Reliability Patterns (reference)", () => {
    test("recommends availability zones", () => {
      expect(clusterConfigContent).toMatch(/availability zone|--zones/i);
    });

    test("mentions PodDisruptionBudgets", () => {
      expect(clusterConfigContent).toMatch(/poddisruptionbudget|pdb/i);
    });

    test("covers upgrade strategy", () => {
      expect(clusterConfigContent).toMatch(/upgrade/i);
    });

    test("mentions maintenance windows", () => {
      expect(clusterConfigContent).toMatch(/maintenance window/i);
    });
  });

  describe("Performance Recommendations (reference)", () => {
    test("recommends ephemeral OS disks", () => {
      expect(clusterConfigContent).toMatch(/ephemeral.*disk|--node-osdisk-type ephemeral/i);
    });

    test("warns against B-series VMs", () => {
      expect(clusterConfigContent).toMatch(/avoid.*b-series|b-series.*avoid/i);
    });

    test("mentions autoscaling", () => {
      expect(clusterConfigContent).toMatch(/autoscal|nap|node auto provisioning/i);
    });
  });

  describe("MCP Tools", () => {
    test("lists MCP tools", () => {
      expect(skill.content).toMatch(/mcp_azure_mcp_aks/i);
    });
  });

  describe("Error Handling", () => {
    test("includes remediation guidance", () => {
      expect(skill.content).toMatch(/remediation|quota|credential/i);
    });
  });

  describe("Guardrails", () => {
    test("warns about secrets handling", () => {
      expect(skill.content).toMatch(/secret|token|key/i);
    });

    test("does not promise zero downtime", () => {
      expect(skill.content).toMatch(/do not promise zero downtime/i);
    });
  });
});
