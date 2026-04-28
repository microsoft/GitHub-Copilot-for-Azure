/**
 * Unit Tests for azure-webpubsub
 *
 * Test skill metadata, content, and repository compliance expectations.
 */

import { readFileSync } from "node:fs";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-webpubsub";

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
      expect(skill.metadata.description.length).toBeGreaterThan(50);
    });

    test("description is concise and domain-specific", () => {
      expect(skill.metadata.description.length).toBeLessThan(1025);
      expect(skill.metadata.description.toLowerCase()).toContain("web pubsub");
    });

    test("description contains WHEN trigger phrases", () => {
      expect(skill.metadata.description).toContain("WHEN:");
    });

    test("frontmatter includes repo-required fields", () => {
      expect(skill.metadata.license).toBe("MIT");
      expect(skill.metadata.metadata).toBeDefined();
      expect((skill.metadata.metadata as { author?: string }).author).toBe("Microsoft");
      expect((skill.metadata.metadata as { version?: string }).version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(300);
    });

    test("contains required repo sections", () => {
      expect(skill.content).toContain("Quick Reference");
      expect(skill.content).toContain("When to Use This Skill");
      expect(skill.content).toContain("MCP Tools");
      expect(skill.content).toContain("Workflow");
      expect(skill.content).toContain("Error Handling");
    });

    test("contains routing workflow and negotiation guidance", () => {
      expect(skill.content).toContain("Choose the server role");
      expect(skill.content).toContain("/negotiate");
      expect(skill.content).toContain("server-owned auth boundary");
    });

    test("includes runtime and server-role guidance", () => {
      expect(skill.content).toContain("@azure/web-pubsub-client");
      expect(skill.content).toContain("WebPubSubServiceClient");
      expect(skill.content).toContain("upstream");
    });

    test("documents MCP tools for repo practice", () => {
      expect(skill.content).toContain("mcp_azure_mcp_documentation");
      expect(skill.content).toContain("mcp_azure_mcp_monitor");
      expect(skill.content).toContain("mcp_azure_mcp_resourcehealth");
    });

    test("links expected guidance files with markdown links", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      expect(raw).toContain("[PubSub Client SDK](references/pubsub-client-sdk.md)");
      expect(raw).toContain("[Server Role Decision](references/server-role-decision.md)");
      expect(raw).toContain("[Web PubSub for Socket.IO](references/webpubsub-for-socketio.md)");
      expect(raw).toContain("[Negotiate Checklist](references/negotiate-checklist.md)");
      expect(raw).toContain("[Existing App Integration](references/existing-app-integration.md)");
      expect(raw).toContain("[Common Pitfalls](references/common-pitfalls.md)");
    });

    test("keeps token-heavy content out of SKILL.md", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const tokens = Math.ceil(raw.length / 4);
      expect(tokens).toBeLessThanOrEqual(500);
    });

    test("keeps references within recommended token budget", () => {
      const refDir = skill.filePath.replace("SKILL.md", "references/");
      const refs = [
        "common-pitfalls.md",
        "existing-app-integration.md",
        "negotiate-checklist.md",
        "pubsub-client-sdk.md",
        "server-role-decision.md",
        "webpubsub-for-socketio.md",
      ];

      for (const ref of refs) {
        const content = readFileSync(`${refDir}${ref}`, "utf-8");
        const tokens = Math.ceil(content.length / 4);
        expect(tokens).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe("Frontmatter Formatting", () => {
    test("frontmatter has no tabs", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      expect(frontmatter).not.toMatch(/\t/);
    });

    test("frontmatter keys are only supported attributes", () => {
      const raw = readFileSync(skill.filePath, "utf-8");
      const frontmatter = raw.split("---")[1];
      const supported = ["name", "description", "compatibility", "license", "metadata",
        "argument-hint", "disable-model-invocation", "user-invokable"];
      const keys = frontmatter.split("\n")
        .filter((line: string) => /^[a-z][\w-]*\s*:/.test(line))
        .map((line: string) => line.split(":")[0].trim());
      for (const key of keys) {
        expect(supported).toContain(key);
      }
    });
  });
});