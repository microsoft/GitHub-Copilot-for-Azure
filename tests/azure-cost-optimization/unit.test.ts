/**
 * Unit Tests for azure-cost-optimization
 * 
 * Tests isolated skill logic and validation rules.
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

    test('description is concise and actionable', () => {
      // Descriptions should be 50-500 chars for readability
      expect(skill.metadata.description.length).toBeGreaterThan(50);
      expect(skill.metadata.description.length).toBeLessThan(1000);
    });

    test('description contains cost optimization triggers', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/cost|spending|optimization|savings/);
    });

    test('description mentions key use cases', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toContain('use for');
      expect(description).toMatch(/orphaned|rightsize|unused/);
    });

    test('description clarifies what NOT to use it for', () => {
      const description = skill.metadata.description.toLowerCase();
      expect(description).toMatch(/do not\s+use for/);
      expect(description).toMatch(/cost estimation|cost-estimation/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(1000);
    });

    test('contains when to use section', () => {
      expect(skill.content).toMatch(/## When to Use/i);
    });

    test('documents step-by-step instructions', () => {
      expect(skill.content).toMatch(/## Instructions/i);
      expect(skill.content).toMatch(/### Step \d+:/);
    });

    test('includes prerequisites validation', () => {
      expect(skill.content).toMatch(/### Step 0: Validate Prerequisites/i);
      expect(skill.content).toContain('Azure CLI');
      expect(skill.content).toContain('azqr');
    });

    test('includes cost query instructions', () => {
      expect(skill.content).toMatch(/### Step \d+: Query Actual Costs/i);
      expect(skill.content).toContain('Cost Management API');
      expect(skill.content).toContain('ActualCost');
    });

    test('includes report generation step', () => {
      expect(skill.content).toMatch(/### Step \d+: Generate Optimization Report/i);
      expect(skill.content).toContain('output/');
      expect(skill.content).toContain('costoptimizereport');
    });

    test('mentions Azure Quick Review (azqr)', () => {
      expect(skill.content).toContain('azqr');
      expect(skill.content).toContain('Azure Quick Review');
      expect(skill.content).toMatch(/orphaned resources/i);
    });

    test('includes data classification guidance', () => {
      expect(skill.content).toContain('ACTUAL DATA');
      expect(skill.content).toContain('ESTIMATED');
      expect(skill.content).toContain('VALIDATED');
    });

    test('includes safety and best practices', () => {
      expect(skill.content).toMatch(/## Important Notes/i);
      expect(skill.content).toMatch(/### Best Practices/i);
      expect(skill.content).toMatch(/### Safety Requirements/i);
    });

    test('includes common pitfalls section', () => {
      expect(skill.content).toMatch(/### Common Pitfalls/i);
      expect(skill.content).toContain('free tier');
    });

    test('mentions audit trail', () => {
      expect(skill.content).toContain('audit trail');
      expect(skill.content).toContain('cost-query-result');
    });

    test('references Redis-specific optimization', () => {
      expect(skill.content).toContain('Redis');
      expect(skill.content).toContain('azure-redis.md');
    });
  });

  describe('Required Tools and Extensions', () => {
    test('documents Azure CLI requirement', () => {
      expect(skill.content).toContain('az login');
      expect(skill.content).toMatch(/Azure CLI/i);
    });

    test('documents azqr installation', () => {
      expect(skill.content).toContain('azqr');
      expect(skill.content).toMatch(/azqr version/i);
    });

    test('lists required Azure CLI extensions', () => {
      expect(skill.content).toContain('costmanagement');
      expect(skill.content).toContain('resource-graph');
    });

    test('documents required permissions', () => {
      expect(skill.content).toMatch(/Cost Management Reader/i);
      expect(skill.content).toMatch(/Monitoring Reader/i);
      expect(skill.content).toMatch(/Reader role/i);
    });
  });

  describe('Cost Analysis Features', () => {
    test('mentions orphaned resources', () => {
      expect(skill.content).toMatch(/orphaned resources/i);
      expect(skill.content).toMatch(/unattached disks|unused NICs/i);
    });

    test('mentions rightsizing', () => {
      expect(skill.content).toMatch(/rightsize|rightsizing/i);
      expect(skill.content).toMatch(/VM|virtual machines/i);
    });

    test('mentions utilization metrics', () => {
      expect(skill.content).toContain('Azure Monitor');
      expect(skill.content).toMatch(/utilization|metrics/i);
      expect(skill.content).toContain('Percentage CPU');
    });

    test('includes pricing validation', () => {
      expect(skill.content).toMatch(/### Step \d+: Validate Pricing/i);
      expect(skill.content).toContain('azure.microsoft.com/pricing');
    });
  });

  describe('Output Structure', () => {
    test('defines output folder convention', () => {
      expect(skill.content).toContain('output/');
      expect(skill.content).toMatch(/costoptimizereport.*\.md/);
    });

    test('defines report structure', () => {
      expect(skill.content).toContain('Executive Summary');
      expect(skill.content).toContain('Cost Breakdown');
      expect(skill.content).toContain('Optimization Recommendations');
      expect(skill.content).toContain('Total Estimated Savings');
    });

    test('includes Azure Portal link format', () => {
      expect(skill.content).toContain('portal.azure.com');
      expect(skill.content).toMatch(/TENANT_ID|SUBSCRIPTION_ID|RESOURCE_GROUP/);
    });

    test('documents audit trail files', () => {
      expect(skill.content).toContain('cost-query-result');
      expect(skill.content).toMatch(/\.json/);
    });
  });

  describe('Report Recommendations', () => {
    test('includes priority-based recommendations', () => {
      expect(skill.content).toContain('Priority 1');
      expect(skill.content).toContain('Priority 2');
      expect(skill.content).toContain('Priority 3');
    });

    test('includes risk assessment in priorities', () => {
      expect(skill.content).toMatch(/High Impact.*Low Risk/);
      expect(skill.content).toMatch(/Medium Impact.*Medium Risk/);
    });

    test('includes implementation commands', () => {
      expect(skill.content).toContain('Implementation Commands');
      expect(skill.content).toMatch(/Commands to execute/i);
    });
  });
});
