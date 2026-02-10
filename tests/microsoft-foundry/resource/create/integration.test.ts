/**
 * Integration Tests for microsoft-foundry:resource/create
 *
 * Tests the skill's behavior when invoked with real scenarios
 */

import { loadSkill } from '../../../utils/skill-loader';

const SKILL_NAME = 'microsoft-foundry';

describe('microsoft-foundry:resource/create - Integration Tests', () => {
  let skill: any;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Skill Loading', () => {
    test('skill loads successfully', () => {
      expect(skill).toBeDefined();
      expect(skill.metadata).toBeDefined();
      expect(skill.content).toBeDefined();
    });

    test('skill has correct name', () => {
      expect(skill.metadata.name).toBe('microsoft-foundry');
    });

    test('skill content includes resource/create reference', () => {
      expect(skill.content).toContain('resource/create');
    });
  });

  describe('Workflow Documentation Accessibility', () => {
    test('references workflows file for detailed steps', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const workflowsPath = path.join(
        __dirname,
        '../../../../plugin/skills/microsoft-foundry/resource/create/references/workflows.md'
      );

      const workflowsExists = await fs.access(workflowsPath).then(() => true).catch(() => false);
      expect(workflowsExists).toBe(true);
    });

    test('workflows file contains all 4 workflows', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const workflowsPath = path.join(
        __dirname,
        '../../../../plugin/skills/microsoft-foundry/resource/create/references/workflows.md'
      );

      const workflowsContent = await fs.readFile(workflowsPath, 'utf-8');

      expect(workflowsContent).toContain('## 1. Create Resource Group');
      expect(workflowsContent).toContain('## 2. Create Foundry Resource');
      expect(workflowsContent).toContain('## 3. Monitor Resource Usage');
      expect(workflowsContent).toContain('## 4. Register Resource Provider');
    });
  });

  describe('Command Validation', () => {
    test('workflows contain valid Azure CLI commands', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const workflowsPath = path.join(
        __dirname,
        '../../../../plugin/skills/microsoft-foundry/resource/create/references/workflows.md'
      );

      const workflowsContent = await fs.readFile(workflowsPath, 'utf-8');

      // Check for key Azure CLI commands
      expect(workflowsContent).toContain('az group create');
      expect(workflowsContent).toContain('az cognitiveservices account create');
      expect(workflowsContent).toContain('az cognitiveservices account list-usage');
      expect(workflowsContent).toContain('az provider register');
      expect(workflowsContent).toContain('--kind AIServices');
    });

    test('commands include required parameters', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const workflowsPath = path.join(
        __dirname,
        '../../../../plugin/skills/microsoft-foundry/resource/create/references/workflows.md'
      );

      const workflowsContent = await fs.readFile(workflowsPath, 'utf-8');

      expect(workflowsContent).toContain('--resource-group');
      expect(workflowsContent).toContain('--name');
      expect(workflowsContent).toContain('--location');
      expect(workflowsContent).toContain('--sku');
    });
  });

  describe('Progressive Disclosure Pattern', () => {
    test('main skill file is lean', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const mainFilePath = path.join(
        __dirname,
        '../../../../plugin/skills/microsoft-foundry/resource/create/create-foundry-resource.md'
      );

      const mainContent = await fs.readFile(mainFilePath, 'utf-8');
      const lineCount = mainContent.split('\n').length;

      // Main file should be relatively lean (under 200 lines)
      expect(lineCount).toBeLessThan(200);
    });

    test('detailed content in references', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const workflowsPath = path.join(
        __dirname,
        '../../../../plugin/skills/microsoft-foundry/resource/create/references/workflows.md'
      );

      const workflowsContent = await fs.readFile(workflowsPath, 'utf-8');
      const lineCount = workflowsContent.split('\n').length;

      // Workflows file should have detailed content
      expect(lineCount).toBeGreaterThan(100);
    });
  });
});
