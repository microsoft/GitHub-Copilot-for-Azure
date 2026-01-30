/**
 * Integration Tests for appinsights-instrumentation
 * 
 * Tests skill behavior with a real Copilot agent session.
 */

let agentRunner = null;
let sdkAvailable = false;

try {
  require.resolve('@github/copilot-sdk');
  agentRunner = require('../utils/agent-runner');
  sdkAvailable = true;
} catch {
  sdkAvailable = false;
}

const SKILL_NAME = 'appinsights-instrumentation';

const shouldSkip = () => !sdkAvailable || process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';
const describeIntegration = shouldSkip() ? describe.skip : describe;

describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  
  test('invokes skill for App Insights setup prompt', async () => {
    const agentMetadata = await agentRunner.run({
      prompt: 'Add Application Insights telemetry to my ASP.NET Core app'
    });

    const isSkillUsed = agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME);
    expect(isSkillUsed).toBe(true);
  });

  test('response mentions instrumentation steps', async () => {
    const agentMetadata = await agentRunner.run({
      prompt: 'How do I instrument my Node.js app with App Insights?'
    });

    const hasExpectedContent = agentRunner.doesAssistantMessageIncludeKeyword(
      agentMetadata, 
      'connection string'
    ) || agentRunner.doesAssistantMessageIncludeKeyword(
      agentMetadata,
      'telemetry'
    );
    expect(hasExpectedContent).toBe(true);
  });

  test('works with ASP.NET Core project', async () => {
    const agentMetadata = await agentRunner.run({
      setup: async (workspace) => {
        const fs = require('fs');
        const path = require('path');
        
        fs.writeFileSync(
          path.join(workspace, 'Program.cs'),
          'var builder = WebApplication.CreateBuilder(args);'
        );
        fs.writeFileSync(
          path.join(workspace, 'app.csproj'),
          '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>'
        );
      },
      prompt: 'Add App Insights to this application'
    });

    expect(agentRunner.isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);
  });
});
