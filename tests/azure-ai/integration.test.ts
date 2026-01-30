/**
 * Integration Tests for azure-ai
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=azure-ai
 */

import { 
  run, 
  isSkillInvoked, 
  areToolCallsSuccess, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests 
} from '../utils/agent-runner';

const SKILL_NAME = 'azure-ai';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for AI Search query', async () => {
    const agentMetadata = await run({
      prompt: 'How do I create a search index in Azure AI Search?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions AI Search capabilities', async () => {
    const agentMetadata = await run({
      prompt: 'What types of search does Azure AI Search support?'
    });

    const hasExpectedContent = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'vector search'
    );
    expect(hasExpectedContent).toBe(true);
  });

  test('invokes skill for Speech service query', async () => {
    const agentMetadata = await run({
      prompt: 'How do I use Azure Speech service for transcription?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions Speech capabilities', async () => {
    const agentMetadata = await run({
      prompt: 'What can Azure Speech service do?'
    });

    const hasSpeechContent = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'speech'
    );
    expect(hasSpeechContent).toBe(true);
  });

  test('invokes skill for Foundry query', async () => {
    const agentMetadata = await run({
      prompt: 'What is Azure AI Foundry and how do I use it?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions Foundry capabilities', async () => {
    const agentMetadata = await run({
      prompt: 'What can I do with Azure AI Foundry?'
    });

    const hasFoundryContent = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'model'
    );
    expect(hasFoundryContent).toBe(true);
  });

  test('invokes skill for OpenAI query', async () => {
    const agentMetadata = await run({
      prompt: 'How do I deploy GPT-4 on Azure OpenAI?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('suggests MCP tools for AI Search operations', async () => {
    const agentMetadata = await run({
      prompt: 'How can I query my Azure AI Search indexes?'
    });

    // Check that the response mentions relevant tools or MCP setup
    const mentionsSearch = doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'search'
    );
    expect(mentionsSearch).toBe(true);
  });

  test('provides MCP setup guidance when tools not available', async () => {
    const agentMetadata = await run({
      prompt: 'Help me use Azure AI Search MCP tools'
    });

    const mentionsMCP = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'mcp'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'azure:setup'
    );
    
    expect(mentionsMCP).toBe(true);
  });
});
