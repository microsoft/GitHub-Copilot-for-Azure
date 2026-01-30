/**
 * Integration Tests for {SKILL_NAME}
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern={skill-name}
 */

// Check if SDK is available before loading agent-runner
let agentRunner = null;
let sdkAvailable = false;

try {
  require.resolve('@github/copilot-sdk');
  agentRunner = require('../utils/agent-runner');
  sdkAvailable = true;
} catch {
  sdkAvailable = false;
}

// Replace with your skill name
const SKILL_NAME = 'your-skill-name';

// Skip integration tests in CI, when SDK unavailable, or when SKIP_INTEGRATION_TESTS is set
const shouldSkip = () => !sdkAvailable || process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';
const describeIntegration = shouldSkip() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  // Example test: Verify the skill is invoked for a relevant prompt
  test('invokes skill for relevant prompt', async () => {
    const agentMetadata = await agentRunner.run({
      prompt: 'Your test prompt that should trigger this skill'
    });

    const isSkillUsed = agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  // Example test: Verify expected content in response
  test('response contains expected keywords', async () => {
    const agentMetadata = await agentRunner.run({
      prompt: 'Your test prompt here'
    });

    const hasExpectedContent = agentRunner.doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'expected keyword'
    );
    expect(hasExpectedContent).toBe(true);
  });

  // Example test: Verify MCP tool calls succeed
  test('MCP tool calls are successful', async () => {
    const agentMetadata = await agentRunner.run({
      prompt: 'Your test prompt that uses Azure tools'
    });

    // Check that azure-documentation (or other relevant tool) calls succeeded
    const toolsSucceeded = agentRunner.areToolCallsSuccess(agentMetadata, 'azure-documentation');
    expect(toolsSucceeded).toBe(true);
  });

  // Example test with workspace setup
  test('works with project files', async () => {
    const agentMetadata = await agentRunner.run({
      setup: async (workspace) => {
        // Create any files needed in the workspace
        const fs = require('fs');
        const path = require('path');
        
        fs.writeFileSync(
          path.join(workspace, 'example.json'),
          JSON.stringify({ key: 'value' })
        );
      },
      prompt: 'Your test prompt that needs workspace files'
    });

    expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });
});
