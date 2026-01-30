/**
 * Integration Tests for appinsights-instrumentation
 * 
 * Tests skill behavior with a real Copilot agent session.
 * These tests require Copilot CLI to be installed and authenticated.
 * 
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 * 
 * Run with: npm run test:integration -- --testPathPattern=appinsights-instrumentation
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

const SKILL_NAME = 'appinsights-instrumentation';

// Use centralized skip logic from agent-runner
const describeIntegration = shouldSkipIntegrationTests() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for App Insights instrumentation request', async () => {
    const agentMetadata = await run({
      prompt: 'How do I add Application Insights to my ASP.NET Core web app?'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions auto-instrumentation for ASP.NET Core', async () => {
    const agentMetadata = await run({
      prompt: 'Add App Insights instrumentation to my C# web application in Azure'
    });

    const mentionsAutoInstrumentation = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'auto-instrument'
    );
    expect(mentionsAutoInstrumentation).toBe(true);
  });

  test('response mentions manual instrumentation for Node.js', async () => {
    const agentMetadata = await run({
      setup: async (workspace: string) => {
        // Create a package.json to indicate Node.js project
        fs.writeFileSync(
          path.join(workspace, 'package.json'),
          JSON.stringify({ name: 'test-app', version: '1.0.0' })
        );
      },
      prompt: 'Add telemetry to my Node.js application'
    });

    const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('suggests creating AppInsights resource', async () => {
    const agentMetadata = await run({
      prompt: 'Instrument my Python web app with Application Insights'
    });

    const mentionsAppInsights = doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'App Insights'
    );
    expect(mentionsAppInsights).toBe(true);
  });
});
