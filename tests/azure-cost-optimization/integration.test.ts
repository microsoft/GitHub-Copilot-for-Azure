/**
 * Integration Tests for azure-cost-optimization
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=azure-cost-optimization
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  run, 
  isSkillInvoked, 
  areToolCallsSuccess, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests 
} from '../utils/agent-runner';

const SKILL_NAME = 'azure-cost-optimization';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for cost optimization prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Help me optimize Azure costs for my subscription'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('invokes skill for orphaned resources prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Find orphaned and unused resources in Azure'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('invokes skill for rightsizing prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Rightsize my Azure VMs to reduce costs'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions cost savings or optimization', async () => {
    const agentMetadata = await run({
      prompt: 'Generate a cost optimization report for my Azure subscription'
    });

    const hasExpectedContent = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'cost'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'optimization'
    );
    expect(hasExpectedContent).toBe(true);
  });

  test('mentions required tools and permissions', async () => {
    const agentMetadata = await run({
      prompt: 'What do I need to run cost optimization analysis?'
    });

    const mentionsTools = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'Azure CLI'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'azqr'
    );
    expect(mentionsTools).toBe(true);
  });

  test('mentions Azure Quick Review for orphaned resources', async () => {
    const agentMetadata = await run({
      prompt: 'How do I find orphaned resources in Azure?'
    });

    const mentionsAzqr = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'azqr'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'Azure Quick Review'
    );
    expect(mentionsAzqr).toBe(true);
  });

  test('suggests Cost Management API for actual costs', async () => {
    const agentMetadata = await run({
      prompt: 'How do I get actual cost data from Azure?'
    });

    const mentionsCostAPI = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'Cost Management'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'costmanagement'
    );
    expect(mentionsCostAPI).toBe(true);
  });

  test('works with Redis cost optimization prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Optimize Azure Redis costs for my subscription'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('mentions report output location', async () => {
    const agentMetadata = await run({
      prompt: 'Generate a cost optimization report'
    });

    const mentionsOutput = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'output'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'report'
    );
    expect(mentionsOutput).toBe(true);
  });

  test('emphasizes safety for destructive operations', async () => {
    const agentMetadata = await run({
      prompt: 'Delete my orphaned Azure resources'
    });

    const mentionsSafety = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'approval'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'warning'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'careful'
    );
    expect(mentionsSafety).toBe(true);
  });
});
