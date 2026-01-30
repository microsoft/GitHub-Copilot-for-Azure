/**
 * Agent Runner Utility
 * 
 * Executes real Copilot agent sessions for integration testing.
 * Adapted from PR #617's runner.ts pattern.
 * 
 * Prerequisites:
 * - Install Copilot CLI: npm install -g @github/copilot-cli
 * - Login: Run `copilot` and follow prompts to authenticate
 */

const { CopilotClient } = require('@github/copilot-sdk');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * @typedef {Object} AgentMetadata
 * @property {Array} events - All session events captured during execution
 */

/**
 * @typedef {Object} TestConfig
 * @property {Function} [setup] - Optional setup function (workspace) => Promise<void>
 * @property {string} prompt - The prompt to send to the agent
 * @property {Function} [shouldEarlyTerminate] - Optional early termination check
 */

/**
 * Run an agent session with the given configuration
 * @param {TestConfig} config - Test configuration
 * @returns {Promise<AgentMetadata>} - Captured agent metadata
 */
async function run(config) {
  const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));

  try {
    // Run optional setup
    if (config.setup) {
      await config.setup(testWorkspace);
    }

    const client = new CopilotClient({
      logLevel: process.env.DEBUG ? 'all' : 'error',
      cwd: testWorkspace
    });

    const skillDirectory = path.resolve(__dirname, '../../plugin/skills');

    const session = await client.createSession({
      model: 'claude-sonnet-4',
      skillDirectories: [skillDirectory],
      mcpServers: {
        azure: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@azure/mcp', 'server', 'start'],
          tools: ['*']
        }
      }
    });

    const agentMetadata = { events: [] };

    const done = new Promise((resolve) => {
      session.on(async (event) => {
        if (process.env.DEBUG) {
          console.log(`=== session event ${event.type}`);
        }

        if (event.type === 'session.idle') {
          resolve();
          return;
        }

        // Capture all events
        agentMetadata.events.push(event);

        // Check for early termination
        if (config.shouldEarlyTerminate) {
          if (config.shouldEarlyTerminate(agentMetadata)) {
            resolve();
            session.abort();
            return;
          }
        }

        // Debug logging for selected events
        if (process.env.DEBUG) {
          if (event.type === 'assistant.message') {
            console.log('Assistant.message:', event.data.content);
          } else if (event.type === 'tool.execution_start') {
            console.log('tool.execution_start:', event.data.toolName);
          } else if (event.type === 'session.error') {
            console.error('Session error:', event.data.message);
          }
        }
      });
    });

    await session.send({ prompt: config.prompt });
    await done;

    await session.destroy();
    await client.stop();

    return agentMetadata;
  } catch (error) {
    console.error('Agent runner error:', error);
    throw error;
  } finally {
    // Cleanup workspace
    try {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if a skill was invoked during the session
 * @param {AgentMetadata} agentMetadata - Captured metadata
 * @param {string} skillName - Name of the skill to check
 * @returns {boolean}
 */
function isSkillInvoked(agentMetadata, skillName) {
  return agentMetadata.events
    .filter(event => event.type === 'tool.execution_start')
    .filter(event => event.data.toolName === 'skill')
    .some(event => {
      const args = event.data.arguments;
      return JSON.stringify(args).includes(skillName);
    });
}

/**
 * Check if all tool calls for a given tool were successful
 * @param {AgentMetadata} agentMetadata - Captured metadata
 * @param {string} toolName - Name of the tool to check
 * @returns {boolean}
 */
function areToolCallsSuccess(agentMetadata, toolName) {
  const executionStartEvents = agentMetadata.events
    .filter(event => event.type === 'tool.execution_start')
    .filter(event => event.data.toolName === toolName);
  
  const executionCompleteEvents = agentMetadata.events
    .filter(event => event.type === 'tool.execution_complete');

  return executionStartEvents.length > 0 && executionStartEvents.every(startEvent => {
    const toolCallId = startEvent.data.toolCallId;
    return executionCompleteEvents.some(
      completeEvent => completeEvent.data.toolCallId === toolCallId && completeEvent.data.success
    );
  });
}

/**
 * Check if assistant messages contain a keyword
 * @param {AgentMetadata} agentMetadata - Captured metadata
 * @param {string} keyword - Keyword to search for
 * @param {Object} [options] - Options
 * @param {boolean} [options.caseSensitive=false] - Case sensitive search
 * @returns {boolean}
 */
function doesAssistantMessageIncludeKeyword(agentMetadata, keyword, options = {}) {
  // Merge all messages and message deltas
  const allMessages = {};
  
  agentMetadata.events.forEach(event => {
    if (event.type === 'assistant.message') {
      allMessages[event.data.messageId] = event.data.content;
    }
    if (event.type === 'assistant.message_delta') {
      if (allMessages[event.data.messageId]) {
        allMessages[event.data.messageId] += event.data.deltaContent;
      } else {
        allMessages[event.data.messageId] = event.data.deltaContent;
      }
    }
  });

  return Object.values(allMessages).some(message => {
    if (options.caseSensitive) {
      return message.includes(keyword);
    }
    return message.toLowerCase().includes(keyword.toLowerCase());
  });
}

/**
 * Get all tool calls made during the session
 * @param {AgentMetadata} agentMetadata - Captured metadata
 * @param {string} [toolName] - Optional filter by tool name
 * @returns {Array} - Array of tool call events
 */
function getToolCalls(agentMetadata, toolName = null) {
  let calls = agentMetadata.events.filter(event => event.type === 'tool.execution_start');
  
  if (toolName) {
    calls = calls.filter(event => event.data.toolName === toolName);
  }
  
  return calls;
}

/**
 * Check if integration tests should be skipped
 * @returns {boolean}
 */
function shouldSkipIntegrationTests() {
  return process.env.SKIP_INTEGRATION_TESTS === 'true' || process.env.CI === 'true';
}

module.exports = {
  run,
  isSkillInvoked,
  areToolCallsSuccess,
  doesAssistantMessageIncludeKeyword,
  getToolCalls,
  shouldSkipIntegrationTests
};
