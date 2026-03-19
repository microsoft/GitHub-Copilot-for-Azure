/**
 * Unit Tests for trace
 *
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkill, LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRACE_MD = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/trace/trace.md"
);
const REFERENCES_PATH = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/foundry-agent/trace/references"
);

describe("trace - Unit Tests", () => {
  let skill: LoadedSkill;
  let traceContent: string;
  let kqlTemplatesContent: string;
  let searchTracesContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    traceContent = fs.readFileSync(TRACE_MD, "utf-8");
    kqlTemplatesContent = fs.readFileSync(
      path.join(REFERENCES_PATH, "kql-templates.md"),
      "utf-8"
    );
    searchTracesContent = fs.readFileSync(
      path.join(REFERENCES_PATH, "search-traces.md"),
      "utf-8"
    );
  });

  describe("Skill Metadata", () => {
    test("has valid SKILL.md with required fields", () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe("microsoft-foundry");
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test("description is appropriately sized", () => {
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

  describe("Hosted Agent Identity Guidance", () => {
    test("keeps hosted-agent filtering on requests-scoped name fields", () => {
      expect(traceContent).toMatch(/Resolve hosted-agent identity from `requests` first/i);
      expect(kqlTemplatesContent).toMatch(/Use `requests` as the hosted-agent entry point/i);
      expect(searchTracesContent).toMatch(/Use `requests` as the preferred entry point/i);
    });

    test("documents parsing agent name and version from gen_ai.agent.id when available", () => {
      expect(traceContent).toContain("gen_ai.agent.id");
      expect(kqlTemplatesContent).toContain("agentNameFromId");
      expect(kqlTemplatesContent).toContain("agentVersion");
      expect(kqlTemplatesContent).toMatch(/<foundry-agent-name>:<version>/i);
      expect(searchTracesContent).toContain("agentVersion");
      expect(searchTracesContent).toContain('split(agentId, ":")');
    });
  });

  describe("Span Discovery Guidance", () => {
    test("documents operation_Id-based span expansion for hosted agents", () => {
      expect(traceContent).toMatch(/Use `operation_Id` to fan out hosted-agent traces/i);
      expect(kqlTemplatesContent).toMatch(/Operation_Id Join \(requests → dependencies\)/i);
      expect(kqlTemplatesContent).toContain("project operation_Id, conversationId, agentVersion");
      expect(kqlTemplatesContent).toContain("join kind=inner agentRequests on operation_Id");
      expect(searchTracesContent).toContain("join kind=inner agentRequests on operation_Id");
      expect(searchTracesContent).toContain("coalesce(");
      expect(searchTracesContent).toContain("operation_Id, agentVersion");
    });

    test("surfaces agent version in hosted-agent conversation summaries", () => {
      expect(searchTracesContent).toContain("| Conversation ID | Agent Version |");
      expect(searchTracesContent).toContain("| conv_abc123 | 3 |");
    });
  });
});
