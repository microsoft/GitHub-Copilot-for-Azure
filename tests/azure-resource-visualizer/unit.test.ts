/**
 * Unit Tests for azure-resource-visualizer
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-resource-visualizer';

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

    test('description is concise and actionable', () => {
      // Descriptions should be 50-1024 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1024);
    });

    test('description contains USE FOR trigger phrases', () => {
      const description = skill.metadata.description;
      expect(description).toContain('USE FOR:');
    });

    test('description contains DO NOT USE FOR anti-triggers', () => {
      const description = skill.metadata.description;
      expect(description).toContain('DO NOT USE FOR:');
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test('contains expected sections', () => {
      expect(skill.content).toContain('## Core Responsibilities');
      expect(skill.content).toContain('## Workflow Process');
      expect(skill.content).toContain('Resource Group Selection');
      expect(skill.content).toContain('Resource Discovery & Analysis');
      expect(skill.content).toContain('Diagram Construction');
    });

    test('includes Mermaid diagram examples', () => {
      expect(skill.content).toContain('Mermaid');
      expect(skill.content).toContain('graph TB');
      expect(skill.content).toContain('graph LR');
    });

    test('defines quality standards', () => {
      expect(skill.content).toContain('Quality Standards');
      expect(skill.content).toContain('Accuracy');
      expect(skill.content).toContain('Completeness');
    });
  });

  describe('Diagram Generation Guidelines', () => {
    test('provides diagram structure guidelines', () => {
      expect(skill.content).toContain('Key Diagram Requirements');
      expect(skill.content).toContain('subgraph');
      expect(skill.content).toContain('Resource Group');
    });

    test('includes relationship mapping guidance', () => {
      expect(skill.content).toContain('Relationship Mapping');
      expect(skill.content).toContain('Network connections');
      expect(skill.content).toContain('Data flow');
    });
  });
});
