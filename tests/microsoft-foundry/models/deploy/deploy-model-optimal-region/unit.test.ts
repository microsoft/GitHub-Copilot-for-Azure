/**
 * Unit Tests for preset (deploy-model-optimal-region)
 * 
 * Test isolated skill logic and validation rules.
 */

import * as fs from "fs";
import * as path from "path";
import { loadSkill, LoadedSkill } from "../../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";
const NESTED_FILE = "models/deploy-model/preset/references/preset-workflow.md";

describe("preset (deploy-model-optimal-region) - Unit Tests", () => {
  let skill: LoadedSkill;
  let referenceContent: string;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    const nestedFilePath = path.join(skill.path, NESTED_FILE);
    referenceContent = fs.readFileSync(nestedFilePath, "utf-8");
  });

  describe("Reference Content", () => {
    test("has substantive content", () => {
      expect(referenceContent).toBeDefined();
      expect(referenceContent.length).toBeGreaterThan(100);
    });

    test("contains expected sections", () => {
      expect(referenceContent).toContain("## Phase 1");
      expect(referenceContent).toContain("## Phase 2");
    });

    test("contains deployment phases", () => {
      expect(referenceContent).toContain("## Phase 1");
      expect(referenceContent).toContain("## Phase 2");
    });

    test("contains Azure CLI commands", () => {
      expect(referenceContent).toContain("az cognitiveservices");
    });

    test("documents GlobalStandard SKU usage", () => {
      expect(referenceContent).toContain("GlobalStandard");
    });
  });
});
