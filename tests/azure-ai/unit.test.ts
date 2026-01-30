/**
 * Unit Tests for azure-ai
 * 
 * Test isolated skill logic and validation rules.
 */

import { loadSkill, LoadedSkill } from '../utils/skill-loader';

const SKILL_NAME = 'azure-ai';

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
      expect(skill.metadata.description.length).toBeLessThan(500);
    });

    test('description mentions Azure AI services', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/ai|search|speech|foundry|openai/);
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('contains AI Search section', () => {
      expect(skill.content).toContain('AI Search');
    });

    test('contains Speech section', () => {
      expect(skill.content).toContain('Speech');
    });

    test('contains Foundry section', () => {
      expect(skill.content).toContain('Foundry');
    });

    test('contains OpenAI section', () => {
      expect(skill.content).toContain('OpenAI');
    });

    test('documents MCP tools', () => {
      expect(skill.content).toMatch(/azure__search|azure__speech|azure__foundry/);
    });

    test('documents AI Search capabilities', () => {
      expect(skill.content).toContain('Full-text search');
      expect(skill.content).toContain('Vector search');
      expect(skill.content).toContain('Hybrid search');
    });

    test('documents Speech capabilities', () => {
      expect(skill.content).toMatch(/Speech-to-text|Text-to-speech/);
    });

    test('documents Foundry capabilities', () => {
      expect(skill.content).toMatch(/Model catalog|AI agents|Prompt flow/);
    });
  });

  describe('Service Coverage', () => {
    test('lists AI Search MCP commands', () => {
      expect(skill.content).toContain('search_index_list');
      expect(skill.content).toContain('search_index_get');
      expect(skill.content).toContain('search_query');
    });

    test('lists Speech MCP commands', () => {
      expect(skill.content).toContain('speech_transcribe');
      expect(skill.content).toContain('speech_synthesize');
    });

    test('lists Foundry MCP commands', () => {
      expect(skill.content).toContain('foundry_model_list');
      expect(skill.content).toContain('foundry_deployment_list');
      expect(skill.content).toContain('foundry_agent_list');
    });
  });

  describe('Documentation Links', () => {
    test('includes Azure AI Search documentation link', () => {
      expect(skill.content).toMatch(/learn\.microsoft\.com.*search/);
    });

    test('includes Azure AI Speech documentation link', () => {
      expect(skill.content).toMatch(/learn\.microsoft\.com.*speech/);
    });

    test('includes Azure AI Foundry documentation link', () => {
      expect(skill.content).toMatch(/learn\.microsoft\.com.*ai-studio/);
    });
  });
});
