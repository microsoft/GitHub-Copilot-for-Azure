/**
 * Integration Tests for microsoft-foundry:resource/create
 *
 * Tests the skill"s behavior when invoked with real scenarios
 */

import { loadSkill, type LoadedSkill } from "../../../utils/skill-loader";

const SKILL_NAME = "microsoft-foundry";

describe("microsoft-foundry:resource/create - Integration Tests", () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Skill Loading", () => {
    test("skill loads successfully", () => {
      expect(skill).toBeDefined();
      expect(skill.metadata).toBeDefined();
      expect(skill.content).toBeDefined();
    });

    test("skill has correct name", () => {
      expect(skill.metadata.name).toBe("microsoft-foundry");
    });

    test("skill content includes resource/create reference", () => {
      expect(skill.content).toContain("resource/create");
    });
  });

  describe("Workflow Documentation", () => {
    test("main file contains all 3 workflows inline", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const mainFilePath = path.join(
        __dirname,
        "../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md"
      );

      const mainContent = await fs.readFile(mainFilePath, "utf-8");

      expect(mainContent).toContain("### 1. Create Resource Group");
      expect(mainContent).toContain("### 2. Create Foundry Resource");
      expect(mainContent).toContain("### 3. Register Resource Provider");
    });
  });

  describe("Command Validation", () => {
    test("skill contains valid Azure CLI commands", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const mainFilePath = path.join(
        __dirname,
        "../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md"
      );

      const mainContent = await fs.readFile(mainFilePath, "utf-8");

      // Check for key Azure CLI commands
      expect(mainContent).toContain("az group create");
      expect(mainContent).toContain("az cognitiveservices account create");
      expect(mainContent).toContain("az provider register");
      expect(mainContent).toContain("--kind AIServices");
    });

    test("commands include required parameters", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const mainFilePath = path.join(
        __dirname,
        "../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md"
      );

      const mainContent = await fs.readFile(mainFilePath, "utf-8");

      expect(mainContent).toContain("--resource-group");
      expect(mainContent).toContain("--name");
      expect(mainContent).toContain("--location");
      expect(mainContent).toContain("--sku");
    });
  });

  describe("References Pattern", () => {
    test("main file is under token limit with condensed content", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const mainFilePath = path.join(
        __dirname,
        "../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md"
      );

      const mainContent = await fs.readFile(mainFilePath, "utf-8");
      const lineCount = mainContent.split("\n").length;

      // Main file should be under 200 lines for token optimization
      expect(lineCount).toBeLessThan(200);
    });

    test("references directory exists with detailed content", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const referencesPath = path.join(
        __dirname,
        "../../../../plugin/skills/microsoft-foundry/resource/create/references"
      );

      const referencesExists = await fs.access(referencesPath).then(() => true).catch(() => false);
      expect(referencesExists).toBe(true);

      // Check for required reference files
      const workflowsPath = path.join(referencesPath, "workflows.md");
      const patternsPath = path.join(referencesPath, "patterns.md");
      const troubleshootingPath = path.join(referencesPath, "troubleshooting.md");

      expect(await fs.access(workflowsPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(patternsPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(troubleshootingPath).then(() => true).catch(() => false)).toBe(true);
    });

    test("main file links to reference files", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const mainFilePath = path.join(
        __dirname,
        "../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md"
      );

      const mainContent = await fs.readFile(mainFilePath, "utf-8");

      expect(mainContent).toContain("./references/workflows.md");
      expect(mainContent).toContain("./references/patterns.md");
      expect(mainContent).toContain("./references/troubleshooting.md");
    });
  });
});
