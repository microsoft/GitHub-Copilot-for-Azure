/**
 * Cost Query Unit Tests for azure-cost
 *
 * Tests specific to the Cost Query (Part 1) workflow.
 * Generic skill structure tests are in unit.test.ts.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Query Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Description Keywords", () => {
    test("description contains cost-query-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/cost|query|spend|breakdown|actual|amortized/);
    });

    test("description mentions query use cases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain("when:");
      expect(description).toMatch(/query|breakdown|spending/);
    });
  });

  describe("Cost Query Workflow", () => {
    test("contains Cost Query Workflow section", () => {
      expect(skill.content).toMatch(/## Part 1: Cost Query Workflow/i);
    });

    test("references Cost Management Query API endpoint", () => {
      expect(skill.content).toMatch(/Microsoft\.CostManagement\/query/);
    });

    test("mentions key guardrails", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/granularity/);
      expect(content).toMatch(/date range/);
      expect(content).toMatch(/groupby/i);
    });
  });
});
