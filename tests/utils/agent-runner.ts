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

import { CopilotClient } from '@github/copilot-sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface SessionEvent {
  type: string;
  data: {
    toolName?: string;
    toolCallId?: string;
    arguments?: unknown;
    content?: string;
    messageId?: string;
    deltaContent?: string;
    success?: boolean;
    message?: string;
    [key: string]: unknown;
  };
}

export interface AgentMetadata {
  events: SessionEvent[];
}

export interface TestConfig {
  setup?: (workspace: string) => Promise<void>;
  prompt: string;
  shouldEarlyTerminate?: (metadata: AgentMetadata) => boolean;
}

export interface KeywordOptions {
  caseSensitive?: boolean;
}

/**
 * Run an agent session with the given configuration
 */
export async function run(config: TestConfig): Promise<AgentMetadata> {
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

    const agentMetadata: AgentMetadata = { events: [] };

    const done = new Promise<void>((resolve) => {
      session.on(async (event: SessionEvent) => {
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
 */
export function isSkillInvoked(agentMetadata: AgentMetadata, skillName: string): boolean {
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
 */
export function areToolCallsSuccess(agentMetadata: AgentMetadata, toolName: string): boolean {
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
 */
export function doesAssistantMessageIncludeKeyword(
  agentMetadata: AgentMetadata, 
  keyword: string, 
  options: KeywordOptions = {}
): boolean {
  // Merge all messages and message deltas
  const allMessages: Record<string, string> = {};
  
  agentMetadata.events.forEach(event => {
    if (event.type === 'assistant.message' && event.data.messageId && event.data.content) {
      allMessages[event.data.messageId] = event.data.content;
    }
    if (event.type === 'assistant.message_delta' && event.data.messageId) {
      if (allMessages[event.data.messageId]) {
        allMessages[event.data.messageId] += event.data.deltaContent ?? '';
      } else {
        allMessages[event.data.messageId] = event.data.deltaContent ?? '';
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
 */
export function getToolCalls(agentMetadata: AgentMetadata, toolName: string | null = null): SessionEvent[] {
  let calls = agentMetadata.events.filter(event => event.type === 'tool.execution_start');
  
  if (toolName) {
    calls = calls.filter(event => event.data.toolName === toolName);
  }
  
  return calls;
}

/**
 * Check if integration tests should be skipped
 */
export function shouldSkipIntegrationTests(): boolean {
  return process.env.SKIP_INTEGRATION_TESTS === 'true' || process.env.CI === 'true';
}