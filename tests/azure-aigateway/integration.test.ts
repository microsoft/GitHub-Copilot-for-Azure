/**
 * Integration Tests for azure-aigateway
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=azure-aigateway
 */

import { 
  run, 
  isSkillInvoked, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests 
} from '../utils/agent-runner';

const SKILL_NAME = 'azure-aigateway';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for AI gateway setup prompt', async () => {
    const agentMetadata = await run({
      prompt: 'How do I set up an AI gateway for my Azure OpenAI model?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions APIM and Basicv2 SKU', async () => {
    const agentMetadata = await run({
      prompt: 'Set up a gateway for my AI model'
    });

    const mentionsAPIM = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'API Management'
    );
    const mentionsBasicv2 = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'Basicv2'
    );
    
    expect(mentionsAPIM || mentionsBasicv2).toBe(true);
  });

  test('invokes skill for semantic caching request', async () => {
    const agentMetadata = await run({
      prompt: 'How do I enable semantic caching for my AI API?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response includes semantic caching configuration', async () => {
    const agentMetadata = await run({
      prompt: 'Enable semantic caching for my Azure OpenAI endpoint'
    });

    const includesCaching = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'semantic-cache'
    );
    
    expect(includesCaching).toBe(true);
  });

  test('invokes skill for rate limiting request', async () => {
    const agentMetadata = await run({
      prompt: 'How do I add rate limiting to my MCP server?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response includes token limit configuration', async () => {
    const agentMetadata = await run({
      prompt: 'Limit tokens per minute for my AI model'
    });

    const includesTokenLimit = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'token'
    );
    
    expect(includesTokenLimit).toBe(true);
  });

  test('invokes skill for content safety request', async () => {
    const agentMetadata = await run({
      prompt: 'Add content safety filtering to my AI endpoint'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('invokes skill for MCP conversion request', async () => {
    const agentMetadata = await run({
      prompt: 'Convert my API to an MCP server'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response includes AI Gateway repository link', async () => {
    const agentMetadata = await run({
      prompt: 'Set up Azure AI Gateway'
    });

    const includesRepoLink = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'AI-Gateway'
    );
    
    expect(includesRepoLink).toBe(true);
  });
});
