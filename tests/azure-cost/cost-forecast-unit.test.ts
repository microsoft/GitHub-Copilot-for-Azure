/**
 * Cost Forecast Unit Tests for azure-cost
 *
 * Tests specific to the Cost Forecast (Part 3) workflow.
 * Generic skill structure tests are in unit.test.ts.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-cost";

describe(`${SKILL_NAME} - Cost Forecast Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Description Keywords", () => {
    test("description contains forecast-related keywords", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/forecast|predict|project|estimate|future/);
    });

    test("description mentions forecast use cases", () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/forecast|predict|projected|estimate/);
    });
  });

  describe("Cost Forecast Workflow", () => {
    test("contains Cost Forecast Workflow section", () => {
      expect(skill.content).toMatch(/## Part 3: Cost Forecast Workflow/i);
    });

    test("references forecast API endpoint", () => {
      expect(skill.content).toMatch(/Microsoft\.CostManagement\/forecast|forecast\s+API/i);
    });
  });

  describe("Forecast Guardrails", () => {
    test("mentions to-date must be in the future", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/future|must be in the future/);
    });

    test("mentions grouping not supported", () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain("grouping");
      expect(content).toMatch(/not supported/);
    });

    test("mentions includeActualCost field", () => {
      expect(skill.content).toContain("includeActualCost");
    });

    test("mentions minimum training data requirement", () => {
      const content = skill.content.toLowerCase();
      expect(content).toMatch(/training data|28 days/);
    });
  });

  describe("Response Type References", () => {
    test("references CostStatus or response types", () => {
      expect(skill.content).toMatch(/CostStatus|("Actual".*"Forecast"|Actual.*Forecast)/);
    });
  });
});
