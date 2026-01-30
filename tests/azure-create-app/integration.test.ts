/**
 * Integration Tests for azure-create-app
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=azure-create-app
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

const SKILL_NAME = 'azure-create-app';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for azure.yaml creation prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Create azure.yaml for my Node.js web application'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('invokes skill for azd init prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Help me initialize azd for my project to deploy to Azure'
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test('response mentions azure.yaml', async () => {
    const agentMetadata = await run({
      prompt: 'Prepare my application for Azure deployment'
    });

    const hasAzureYaml = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'azure.yaml'
    );
    expect(hasAzureYaml).toBe(true);
  });

  test('response mentions infrastructure generation', async () => {
    const agentMetadata = await run({
      prompt: 'Set up Azure infrastructure for my app'
    });

    const hasInfrastructure = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'infrastructure'
    );
    expect(hasInfrastructure).toBe(true);
  });

  test('MCP tool calls for azure__azd succeed', async () => {
    const agentMetadata = await run({
      prompt: 'Generate Azure deployment configuration for my Python web app'
    });

    // Check that azure__azd tool calls succeeded
    const toolsSucceeded = areToolCallsSuccess(agentMetadata, 'azure__azd');
    expect(toolsSucceeded).toBe(true);
  });

  test('works with existing package.json', async () => {
    const agentMetadata = await run({
      setup: async (workspace: string) => {
        // Create a simple Node.js package.json
        fs.writeFileSync(
          path.join(workspace, 'package.json'),
          JSON.stringify({
            name: 'test-app',
            version: '1.0.0',
            main: 'index.js'
          }, null, 2)
        );
      },
      prompt: 'Configure this Node.js project for Azure deployment'
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });

  test('mentions Bicep templates', async () => {
    const agentMetadata = await run({
      prompt: 'Generate infrastructure as code for my Azure deployment'
    });

    const hasBicep = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'bicep'
    );
    expect(hasBicep).toBe(true);
  });
});
