/**
 * Unit Tests for azure-ai
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

    test('description mentions Azure AI services', () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/azure ai|ai search|speech|foundry|openai|document intelligence/);
    });

    test('description includes USE FOR guidance', () => {
      expect(skill.metadata.description).toContain('USE FOR');
    });

    test('description includes DO NOT USE FOR guidance', () => {
      expect(skill.metadata.description).toContain('DO NOT USE FOR');
    });
  });

  describe('Skill Content', () => {
    test('has substantive content', () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(500);
    });

    test('documents services table', () => {
      expect(skill.content).toMatch(/## Services/i);
      expect(skill.content).toContain('AI Search');
      expect(skill.content).toContain('Speech');
      expect(skill.content).toContain('Foundry');
      expect(skill.content).toContain('OpenAI');
      expect(skill.content).toContain('Document Intelligence');
    });

    test('documents MCP Server section', () => {
      expect(skill.content).toMatch(/## MCP Server/i);
      expect(skill.content).toContain('azure__search');
      expect(skill.content).toContain('azure__speech');
      expect(skill.content).toContain('azure__foundry');
    });
  });

  describe('AI Search Coverage', () => {
    test('documents AI Search capabilities', () => {
      expect(skill.content).toMatch(/## AI Search Capabilities/i);
      expect(skill.content).toContain('Full-text search');
      expect(skill.content).toContain('Vector search');
      expect(skill.content).toContain('Hybrid search');
    });

    test('lists AI Search MCP commands', () => {
      expect(skill.content).toContain('search_index_list');
      expect(skill.content).toContain('search_index_get');
      expect(skill.content).toContain('search_query');
    });
  });

  describe('Speech Coverage', () => {
    test('documents Speech capabilities', () => {
      expect(skill.content).toMatch(/## Speech Capabilities/i);
      expect(skill.content).toContain('Speech-to-text');
      expect(skill.content).toContain('Text-to-speech');
    });

    test('lists Speech MCP commands', () => {
      expect(skill.content).toContain('speech_transcribe');
      expect(skill.content).toContain('speech_synthesize');
    });
  });

  describe('Foundry Coverage', () => {
    test('documents Foundry capabilities', () => {
      expect(skill.content).toMatch(/## Foundry Capabilities/i);
      expect(skill.content).toContain('Model catalog');
      expect(skill.content).toContain('AI agents');
      expect(skill.content).toContain('Prompt flow');
    });

    test('lists Foundry MCP commands', () => {
      expect(skill.content).toContain('foundry_model_list');
      expect(skill.content).toContain('foundry_deployment_list');
      expect(skill.content).toContain('foundry_agent_list');
    });
  });

  describe('Documentation Links', () => {
    test('references Azure documentation', () => {
      expect(skill.content).toContain('learn.microsoft.com');
      expect(skill.content).toContain('azure/search');
      expect(skill.content).toContain('speech-service');
      expect(skill.content).toContain('ai-studio');
    });
  });
});
