/**
 * Agent Runner Utility
 * 
 * Executes real Copilot agent sessions for integration testing.
 * Adapted from the project's existing runner.ts pattern.
 * 
 * Prerequisites:
 * - Install Copilot CLI: npm install -g @github/copilot-cli
 * - Login: Run `copilot` and follow prompts to authenticate
 * 
 * Security Note: The config.setup callback receives the workspace path
 * and executes with full process permissions. Only use with trusted test code.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Type definitions for the SDK (defined locally to avoid import issues)
export interface SessionEvent {
  type: string;
  data: {
    messageId?: string;
    content?: string;
    deltaContent?: string;
    toolName?: string;
    toolCallId?: string;
    arguments?: unknown;
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
  nonInteractive?: boolean;
}

export interface KeywordOptions {
  caseSensitive?: boolean;
}

// Lazy-loaded SDK
let CopilotClientClass: any = null;
let sdkLoadError: Error | null = null;

async function getCopilotClient() {
  if (sdkLoadError) {
    throw sdkLoadError;
  }
  if (!CopilotClientClass) {
    try {
      // Manually construct the SDK path to bypass Jest's module resolution
      const sdkPath = path.join(__dirname, '..', 'node_modules', '@github', 'copilot-sdk', 'dist', 'index.js');
      const { pathToFileURL } = await import('url');
      const sdkUrl = pathToFileURL(sdkPath).href;
      if (process.env.DEBUG) {
        console.log('SDK path:', sdkPath);
        console.log('SDK URL:', sdkUrl);
      }
      // Use eval to bypass Jest's static import() transformation
      // eslint-disable-next-line no-eval
      const dynamicImport = eval('(url) => import(url)');
      const sdk = await dynamicImport(sdkUrl);
      CopilotClientClass = sdk.CopilotClient;
    } catch (error) {
      const errorMsg = (error as Error).message + '\n' + (error as Error).stack;
      if (process.env.DEBUG) {
        console.error('SDK load error:', errorMsg);
      }
      sdkLoadError = new Error('Failed to load @github/copilot-sdk. Ensure Node.js has ESM support and the SDK is installed. Error: ' + errorMsg);
      throw sdkLoadError;
    }
  }
  return CopilotClientClass;
}

/**
 * Run an agent session with the given configuration
 */
export async function run(config: TestConfig): Promise<AgentMetadata> {
  const CopilotClient = await getCopilotClient();
  
  const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));

  // Declare client and session outside try block to ensure cleanup in finally
  let client: any;
  let session: any;

  try {
    // Run optional setup
    if (config.setup) {
      await config.setup(testWorkspace);
    }

    // Copilot client with yolo mode and non-interactive session.
    // Enables longer chats with full conversation history for the skill.
    // -p must come first before other args.
    let cliArgs: string[] = config.nonInteractive ? ['-p', '--yolo'] : [];
    if (process.env.DEBUG)
    {
      cliArgs.push('--log-dir');
      cliArgs.push(`${buildLogFilePath()}`);
    }
    
    client = new CopilotClient({
      logLevel: process.env.DEBUG ? 'all' : 'error',
      cwd: testWorkspace,
      cliArgs: cliArgs,
    });

    const skillDirectory = path.resolve(__dirname, '../../plugin/skills');

    session = await client.createSession({
      model: 'claude-sonnet-4.5',
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
      session!.on(async (event: SessionEvent) => {
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
            session!.abort();
            return;
          }
        }
      });
    });

    await session.send({ prompt: config.prompt });
    await done;

    return agentMetadata;
  } catch (error) {
    console.error('Agent runner error:', error);
    throw error;
  } finally {
    // Cleanup session and client (guarded if undefined)
    try {
      if (session) {
        await session.destroy();
      }
    } catch {
      // Ignore session cleanup errors
    }
    try {
      if (client) {
        await client.stop();
      }
    } catch {
      // Ignore client cleanup errors
    }
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
export function areToolCallsSuccess(agentMetadata: AgentMetadata, toolName: string | null = null): boolean {
  let executionStartEvents = agentMetadata.events
    .filter(event => event.type === 'tool.execution_start');

  if (toolName != null) {
    executionStartEvents = executionStartEvents
      .filter(event => event.data.toolName === toolName);
  }
  
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

// Track skip reason for reporting
let integrationSkipReason: string | null = null;

/**
 * Check if integration tests should be skipped
 * 
 * Integration tests are skipped when:
 * - Running in CI (CI=true)
 * - SKIP_INTEGRATION_TESTS=true is set
 * - @github/copilot-sdk is not installed
 */
export function shouldSkipIntegrationTests(): boolean {
  // Always skip in CI
  if (process.env.CI === 'true') {
    integrationSkipReason = 'Running in CI environment';
    return true;
  }
  
  // Skip if explicitly requested
  if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
    integrationSkipReason = 'SKIP_INTEGRATION_TESTS=true';
    return true;
  }
  
  // Check if SDK package exists
  try {
    const fs = require('fs');
    const path = require('path');
    const sdkPath = path.join(__dirname, '..', 'node_modules', '@github', 'copilot-sdk', 'package.json');
    if (!fs.existsSync(sdkPath)) {
      integrationSkipReason = '@github/copilot-sdk not installed';
      return true;
    }
  } catch {
    integrationSkipReason = '@github/copilot-sdk not installed';
    return true;
  }
  
  // SDK installed, tests should attempt to run
  integrationSkipReason = null;
  return false;
}

/**
 * Get the reason why integration tests are being skipped
 */
export function getIntegrationSkipReason(): string | null {
  return integrationSkipReason;
}

/**
 * Common Azure deployment link patterns
 */
const DEPLOY_LINK_PATTERNS = [
  // Azure Portal resource links
  /https:\/\/portal\.azure\.com\/#[@\/]resource\/subscriptions\/[a-f0-9-]+\/resourceGroups\/[\w-]+/i,
  // Azure App Service URLs
  /https?:\/\/[\w-]+\.azurewebsites\.net/i,
  // Azure Static Web Apps URLs
  /https:\/\/[\w-]+\.azurestaticapps\.net/i,
  // Azure Container Apps URLs
  /https:\/\/[\w-]+\.[\w-]+\.azurecontainerapps\.io/i,
  // Azure Portal direct links
  /https:\/\/portal\.azure\.com\/#blade\/[\w\/]+/i,
];

/**
 * Get all assistant messages from agent metadata
 */
function getAllAssistantMessages(agentMetadata: AgentMetadata): string {
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

  return Object.values(allMessages).join('\n');
}

/**
 * Check if the agent response contains any Azure deployment links
 */
export function hasDeployLinks(agentMetadata: AgentMetadata): boolean {
  const content = getAllAssistantMessages(agentMetadata);
  
  return DEPLOY_LINK_PATTERNS.some(pattern => pattern.test(content));
}

const DEFAULT_REPORT_DIR = path.join(__dirname, '..', 'reports');
const TIME_STAMP = new Date().toISOString().replace(/[:.]/g, '-');

export function buildShareFilePath(): string {
    return path.join(DEFAULT_REPORT_DIR, `test-run-${TIME_STAMP}`, getTestName(), 'agent-metadata.md');
}

export function buildLogFilePath(): string {
    return path.join(DEFAULT_REPORT_DIR, `test-run-${TIME_STAMP}`, getTestName());
}

function getTestName(): string {
    try {``
        // Jest provides expect.getState() with current test info
        const state = expect.getState();
        const testName = state.currentTestName ?? 'unknown-test';
        // Sanitize for use as filename
        return sanitizeFileName(testName);
    } catch {
        // Fallback if not running in Jest context
        return `test-${Date.now()}`;
    }
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFileName(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars
        .replace(/\s+/g, '_')           // Replace spaces with underscores
        .replace(/-+/g, '-')            // Collapse multiple dashes
        .replace(/_+/g, '_')            // Collapse multiple underscores
        .replace(/_-_/g, '-')          
        .substring(0, 200);             // Limit length
}