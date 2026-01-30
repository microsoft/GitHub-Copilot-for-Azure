/**
 * Unit Tests for azure-deploy
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-deploy';

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe('Skill Metadata', () => {
    test('has valid SKILL.md with required fields', () => {
      expect(skill.metadata).toBeDefined();
      expect(skill.metadata.name).toBe(SKILL_NAME);
      expect(skill.metadata.description).toBeDefined();
      expect(skill.metadata.description.length).toBeGreaterThan(10);
    });

    test('description mentions deployment or Azure', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/deploy|azure|azd|publish|host/);
    });

    test('description is concise and actionable', () => {
      // Descriptions should be 50-500 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(500);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('documents execution flow', () => {
      expect(skill.content).toMatch(/## Execution Flow/i);
    });

    test('mentions checking for azure.yaml', () => {
      expect(skill.content).toContain('azure.yaml');
      expect(skill.content).toMatch(/check.*azure\.yaml/i);
    });

    test('documents environment management', () => {
      expect(skill.content).toMatch(/## Environment Management/i);
      expect(skill.content).toContain('azd env new');
      expect(skill.content).toContain('azd env select');
      expect(skill.content).toContain('azd env list');
    });

    test('documents subscription configuration', () => {
      expect(skill.content).toContain('AZURE_SUBSCRIPTION_ID');
      expect(skill.content).toContain('subscription_list');
    });

    test('documents location configuration', () => {
      expect(skill.content).toContain('AZURE_LOCATION');
      expect(skill.content).toMatch(/list-locations|region/i);
    });

    test('documents deployment command', () => {
      expect(skill.content).toContain('azd up');
      expect(skill.content).toContain('--no-prompt');
    });

    test('documents error handling', () => {
      expect(skill.content).toMatch(/## Troubleshooting|### Step 6: Handle Errors/i);
      expect(skill.content).toContain('error_troubleshooting');
    });

    test('references troubleshooting documentation', () => {
      expect(skill.content).toContain('references/TROUBLESHOOTING.md');
    });

    test('documents post-deployment commands', () => {
      expect(skill.content).toMatch(/## Post-Deployment Commands/i);
      expect(skill.content).toContain('azd monitor');
    });

    test('warns about azd down command', () => {
      expect(skill.content).toContain('azd down');
      expect(skill.content).toMatch(/WARNING|DESTRUCTIVE/i);
    });
  });

  describe('Azure Developer CLI Commands', () => {
    test('lists azd up command', () => {
      expect(skill.content).toContain('azd up');
    });

    test('lists azd provision command', () => {
      expect(skill.content).toContain('azd provision');
    });

    test('lists azd deploy command', () => {
      expect(skill.content).toContain('azd deploy');
    });

    test('lists azd env commands', () => {
      expect(skill.content).toContain('azd env new');
      expect(skill.content).toContain('azd env get-values');
      expect(skill.content).toContain('azd env set');
    });

    test('lists azd auth login command', () => {
      expect(skill.content).toContain('azd auth login');
    });

    test('lists azd monitor commands', () => {
      expect(skill.content).toContain('azd monitor');
    });
  });

  describe('MCP Tool References', () => {
    test('references azure__subscription_list tool', () => {
      expect(skill.content).toContain('azure__subscription_list');
    });

    test('references azure__azd tool', () => {
      expect(skill.content).toContain('azure__azd');
    });
  });

  describe('Configuration Management', () => {
    test('documents azd config get defaults', () => {
      expect(skill.content).toContain('azd config get defaults');
    });

    test('documents environment variables', () => {
      expect(skill.content).toContain('azd env set');
      expect(skill.content).toContain('azd env get-values');
    });
  });

  describe('Error Scenarios', () => {
    test('documents common errors', () => {
      expect(skill.content).toMatch(/not authenticated|environment not found|bicep compilation/i);
    });

    test('provides resolutions for common errors', () => {
      const content = skill.content.toLowerCase();
      expect(content).toContain('not authenticated');
      expect(content).toContain('azd auth login');
    });
  });
});
