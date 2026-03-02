/**
 * Unit Tests for azure-kubernetes
 *
 * Tests skill content and structure without requiring external services.
 * Focuses on domain invariants rather than exact formatting.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-kubernetes";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Metadata", () => {
    test("has required frontmatter fields", () => {
      expect(skill.metadata.name).toBe("azure-kubernetes");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(50);
    });

    test("description contains WHEN triggers", () => {
      expect(skill.metadata.description).toMatch(/WHEN:/i);
    });

    test("description mentions key AKS concepts", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/aks|kubernetes/);
      // Description should mention core topics covered by the skill
      expect(desc).toMatch(/cluster|networking|security|deploy/);
    });
  });

  describe("Required Section Structure", () => {
    test("contains the standard skill sections", () => {
      expect(skill.content).toContain("## Quick Reference");
      expect(skill.content).toContain("## When to Use This Skill");
      expect(skill.content).toContain("## MCP Tools");
      expect(skill.content).toContain("## Workflow");
      expect(skill.content).toContain("## Error Handling");
    });

    test("identifies networking as hard-to-change decision", () => {
      const content = skill.content.toLowerCase();
      // Networking is a Day-0 decision that's hard to change after cluster creation
      expect(content).toMatch(/network|cni|pod ip/i);
    });
  });

  describe("Day-0 vs Day-1 Guidance", () => {
    test("distinguishes between Day-0 and Day-1 decisions", () => {
      expect(skill.content).toMatch(/Day-0/i);
      expect(skill.content).toMatch(/Day-1/i);
    });

    test("identifies networking as Day-0 decision", () => {
      expect(skill.content).toMatch(/networking.*day-0|day-0.*networking/i);
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

  describe("Networking Guidance", () => {
    test("covers Azure CNI options", () => {
      expect(skill.content).toMatch(/Azure CNI/i);
    });

    test("covers overlay networking", () => {
      expect(skill.content).toMatch(/overlay/i);
    });

    test("covers egress patterns", () => {
      expect(skill.content).toMatch(/egress/i);
    });

    test("covers ingress options", () => {
      expect(skill.content).toMatch(/ingress/i);
    });
  });

  describe("Security Best Practices", () => {
    test("recommends Entra ID / Azure AD", () => {
      expect(skill.content).toMatch(/entra|azure ad/i);
    });

    test("recommends Workload Identity", () => {
      expect(skill.content).toMatch(/workload identity/i);
    });

    test("recommends Key Vault integration", () => {
      expect(skill.content).toMatch(/key vault/i);
    });

    test("warns against static credentials", () => {
      expect(skill.content).toMatch(/avoid.*static|static.*credential/i);
    });

    test("mentions Azure Policy", () => {
      expect(skill.content).toMatch(/azure policy/i);
    });
  });

  describe("Observability Guidance", () => {
    test("mentions monitoring options", () => {
      expect(skill.content).toMatch(/monitor|observability/i);
    });

    test("mentions Prometheus", () => {
      expect(skill.content).toMatch(/prometheus/i);
    });

    test("mentions Grafana", () => {
      expect(skill.content).toMatch(/grafana/i);
    });
  });

  describe("Reliability Patterns", () => {
    test("recommends availability zones", () => {
      expect(skill.content).toMatch(/availability zone|--zones/i);
    });

    test("mentions PodDisruptionBudgets", () => {
      expect(skill.content).toMatch(/poddisruptionbudget|pdb/i);
    });

    test("covers upgrade strategy", () => {
      expect(skill.content).toMatch(/upgrade/i);
    });

    test("mentions maintenance windows", () => {
      expect(skill.content).toMatch(/maintenance window/i);
    });
  });

  describe("Performance Recommendations", () => {
    test("recommends ephemeral OS disks", () => {
      expect(skill.content).toMatch(/ephemeral.*disk|--node-osdisk-type ephemeral/i);
    });

    test("warns against B-series VMs", () => {
      expect(skill.content).toMatch(/avoid.*b-series|b-series.*avoid/i);
    });

    test("mentions autoscaling", () => {
      expect(skill.content).toMatch(/autoscal|cluster.?autoscaler/i);
    });
  });

  describe("MCP Tools Section", () => {
    test("lists MCP tools", () => {
      expect(skill.content).toMatch(/mcp_azure_mcp_aks|mcp_aks_mcp/i);
    });

    test("has MCP Tools section", () => {
      expect(skill.content).toMatch(/## MCP Tools/i);
    });
  });

  describe("Error Handling Section", () => {
    test("has Error Handling section", () => {
      expect(skill.content).toMatch(/## Error Handling/i);
    });

    test("includes remediation guidance", () => {
      expect(skill.content).toMatch(/remediation|quota|policy/i);
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