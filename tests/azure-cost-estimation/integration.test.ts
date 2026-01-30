/**
 * Integration Tests for azure-cost-estimation
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=azure-cost-estimation
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

const SKILL_NAME = 'azure-cost-estimation';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for cost estimation prompt', async () => {
    const agentMetadata = await run({
      prompt: 'How much will this Azure deployment cost?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response contains cost-related keywords', async () => {
    const agentMetadata = await run({
      prompt: 'Estimate the cost of deploying a Standard_D4s_v3 VM in East US'
    });

    const hasExpectedContent = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'cost'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'price'
    );
    expect(hasExpectedContent).toBe(true);
  });

  test('works with Bicep template file', async () => {
    const agentMetadata = await run({
      setup: async (workspace: string) => {
        // Create a simple Bicep template
        const bicepContent = `
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mystorageaccount'
  location: 'eastus'
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
`;
        fs.writeFileSync(
          path.join(workspace, 'main.bicep'),
          bicepContent
        );
      },
      prompt: 'Estimate the cost of deploying main.bicep'
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test('handles region comparison request', async () => {
    const agentMetadata = await run({
      prompt: 'Compare Azure costs between East US and West Europe for a D4s v3 VM'
    });

    const hasRegionComparison = doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'region'
    ) || doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'east'
    );
    
    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    expect(hasRegionComparison).toBe(true);
  });

  test('responds to monthly cost inquiry', async () => {
    const agentMetadata = await run({
      prompt: "What's the monthly cost of running a Standard_D4s_v3 VM?"
    });

    const hasMonthlyInfo = doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'monthly'
    );
    
    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
    expect(hasMonthlyInfo).toBe(true);
  });
});
