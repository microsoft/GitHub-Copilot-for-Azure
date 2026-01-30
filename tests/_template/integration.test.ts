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

import * as fs from 'fs';
import * as path from 'path';
import { 
  run, 
  isSkillInvoked, 
  areToolCallsSuccess, 
  doesAssistantMessageIncludeKeyword,
  shouldSkipIntegrationTests 
} from '../utils/agent-runner';

// Replace with your skill name
const SKILL_NAME = 'your-skill-name';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  // Example test: Verify the skill is invoked for a relevant prompt
  test('invokes skill for relevant prompt', async () => {
    const agentMetadata = await run({
      prompt: 'Your test prompt that should trigger this skill'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  // Example test: Verify expected content in response
  test('response contains expected keywords', async () => {
    const agentMetadata = await run({
      prompt: 'Your test prompt here'
    });

    const hasExpectedContent = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'expected keyword'
    );
    expect(hasExpectedContent).toBe(true);
  });

  // Example test: Verify MCP tool calls succeed
  test('MCP tool calls are successful', async () => {
    const agentMetadata = await run({
      prompt: 'Your test prompt that uses Azure tools'
    });

    // Check that azure-documentation (or other relevant tool) calls succeeded
    const toolsSucceeded = areToolCallsSuccess(agentMetadata, 'azure-documentation');
    expect(toolsSucceeded).toBe(true);
  });

  // Example test with workspace setup
  test('works with project files', async () => {
    const agentMetadata = await run({
      setup: async (workspace: string) => {
        // Create any files needed in the workspace
        fs.writeFileSync(
          path.join(workspace, 'example.json'),
          JSON.stringify({ key: 'value' })
        );
      },
      prompt: 'Your test prompt that needs workspace files'
    });

    expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });
});
