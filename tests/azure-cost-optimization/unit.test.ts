/**
 * Unit Tests for azure-cost-optimization
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-cost-optimization';

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

    test('description mentions cost optimization or savings', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/cost|savings|optimization|spending|waste/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains when to use section', () => {
      expect(skill.content).toMatch(/## When to [Uu]se/);
    });

    test('documents prerequisites', () => {
      expect(skill.content).toMatch(/## Prerequisites|### Step 0/i);
      expect(skill.content).toContain('Azure CLI');
    });

    test('documents required tools', () => {
      expect(skill.content).toContain('azqr');
      expect(skill.content).toContain('costmanagement');
    });

    test('documents required permissions', () => {
      expect(skill.content).toContain('Cost Management Reader');
      expect(skill.content).toContain('Reader role');
    });

    test('references Azure Quick Review', () => {
      expect(skill.content).toContain('Azure Quick Review');
      expect(skill.content).toContain('azqr');
    });

    test('mentions cost query and API', () => {
      expect(skill.content).toContain('Cost Management API');
      expect(skill.content).toContain('cost-query');
    });

    test('includes output directory structure', () => {
      expect(skill.content).toContain('output/');
      expect(skill.content).toContain('costoptimizereport');
    });

    test('references best practices', () => {
      expect(skill.content).toMatch(/best practices|Best Practices/);
    });

    test('mentions Redis optimization', () => {
      expect(skill.content).toContain('Redis');
      expect(skill.content).toMatch(/redis-specific|Azure Cache for Redis/i);
    });
  });

  describe('Report Structure', () => {
    test('documents report sections', () => {
      expect(skill.content).toContain('Executive Summary');
      expect(skill.content).toContain('Cost Breakdown');
      expect(skill.content).toContain('Orphaned Resources');
      expect(skill.content).toContain('Optimization Recommendations');
    });

    test('documents data classification', () => {
      expect(skill.content).toContain('ACTUAL DATA');
      expect(skill.content).toContain('ESTIMATED SAVINGS');
      expect(skill.content).toContain('VALIDATED PRICING');
    });

    test('includes audit trail requirements', () => {
      expect(skill.content).toContain('audit trail');
      expect(skill.content).toContain('cost-query-result');
    });
  });

  describe('Steps and Instructions', () => {
    test('documents step-by-step process', () => {
      expect(skill.content).toMatch(/### Step \d+:/);
      expect(skill.content).toContain('Step 0');
      expect(skill.content).toContain('Step 1');
    });

    test('includes validation commands', () => {
      expect(skill.content).toContain('az --version');
      expect(skill.content).toContain('az account show');
    });

    test('includes cost query examples', () => {
      expect(skill.content).toContain('cost-query.json');
      expect(skill.content).toContain('ActualCost');
    });

    test('mentions Azure Monitor metrics', () => {
      expect(skill.content).toContain('Azure Monitor');
      expect(skill.content).toContain('az monitor metrics');
    });
  });

  describe('Safety and Best Practices', () => {
    test('includes safety requirements', () => {
      expect(skill.content).toMatch(/safety|approval|warning/i);
    });

    test('warns about destructive operations', () => {
      expect(skill.content).toMatch(/never execute destructive|get approval before deleting/i);
    });

    test('mentions Portal links', () => {
      expect(skill.content).toContain('portal.azure.com');
      expect(skill.content).toContain('Azure Portal');
    });

    test('documents common pitfalls', () => {
      expect(skill.content).toContain('Common Pitfalls');
    });
  });
});
