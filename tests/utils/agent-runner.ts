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

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { type CopilotSession, CopilotClient, type SessionEvent } from "@github/copilot-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AgentMetadata {
  events: SessionEvent[];
}

export interface TestConfig {
  setup?: (workspace: string) => Promise<void>;
  prompt: string;
  shouldEarlyTerminate?: (metadata: AgentMetadata) => boolean;
  nonInteractive?: boolean;
  followUp?: string[];
  systemPrompt?: {
    mode: "append" | "replace",
    content: string
  };
  preserveWorkspace?: boolean;
}

export interface KeywordOptions {
  caseSensitive?: boolean;
}

/**
 * Generate a markdown report from agent metadata
 */
function generateMarkdownReport(config: TestConfig, agentMetadata: AgentMetadata): string {
  const lines: string[] = [];

  // User Prompt section
  lines.push("# User Prompt");
  lines.push("");
  lines.push(config.prompt);
  lines.push("");

  // Process events in chronological order
  lines.push("# Assistant");
  lines.push("");

  // Track message deltas to reconstruct full messages
  const messageDeltas: Record<string, string> = {};
  const reasoningDeltas: Record<string, string> = {};
  const toolResults: Record<string, { success: boolean; content?: string; error?: string }> = {};

  // First pass: collect all tool results
  for (const event of agentMetadata.events) {
    if (event.type === "tool.execution_complete") {
      const toolCallId = event.data.toolCallId as string;
      const result = event.data.result as { content?: string } | undefined;
      const error = event.data.error as { message?: string } | undefined;
      toolResults[toolCallId] = {
        success: event.data.success as boolean,
        content: result?.content,
        error: error?.message
      };
    }
  }

  // Second pass: generate output in order
  for (const event of agentMetadata.events) {
    switch (event.type) {
      case "assistant.message": {
        const content = event.data.content as string;
        if (content) {
          lines.push(content);
          lines.push("");
        }
        break;
      }

      case "assistant.message_delta": {
        // Accumulate deltas for streaming - we'll use the final message instead
        const messageId = event.data.messageId as string;
        const deltaContent = event.data.deltaContent as string;
        if (messageId && deltaContent) {
          messageDeltas[messageId] = (messageDeltas[messageId] || "") + deltaContent;
        }
        break;
      }

      case "assistant.reasoning": {
        const content = event.data.content as string;
        if (content) {
          lines.push("> **Reasoning:**");
          lines.push("> " + content.split("\n").join("\n> "));
          lines.push("");
        }
        break;
      }

      case "assistant.reasoning_delta": {
        // Accumulate reasoning deltas
        const reasoningId = event.data.reasoningId as string;
        const deltaContent = event.data.deltaContent as string;
        if (reasoningId && deltaContent) {
          reasoningDeltas[reasoningId] = (reasoningDeltas[reasoningId] || "") + deltaContent;
        }
        break;
      }

      case "tool.execution_start": {
        const toolName = event.data.toolName as string;
        const toolCallId = event.data.toolCallId as string;
        const args = event.data.arguments;

        // Check if this is a skill invocation
        if (toolName === "skill") {
          const argsStr = JSON.stringify(args);
          // Extract skill name from arguments
          const skillMatch = argsStr.match(/"skill"\s*:\s*"([^"]+)"/);
          const skillName = skillMatch ? skillMatch[1] : "unknown";
          lines.push("```");
          lines.push(`skill: ${skillName}`);
          lines.push("```");
        } else {
          // Regular tool call
          let argsJson = "{}";
          try {
            argsJson = JSON.stringify(args, null, 2);
          } catch {
            argsJson = String(args);
          }
          lines.push("```");
          lines.push(`tool: ${toolName}`);
          lines.push(`arguments: ${argsJson}`);

          // Add tool response if available
          const result = toolResults[toolCallId];
          if (result) {
            if (result.success && result.content) {
              let content = result.content;
              if (content.length > 500) {
                content = content.substring(0, 500) + "... (truncated)";
              }
              lines.push(`response: ${content}`);
            } else if (!result.success && result.error) {
              let error = result.error;
              if (error.length > 500) {
                error = error.substring(0, 500) + "... (truncated)";
              }
              lines.push(`error: ${error}`);
            }
          }
          lines.push("```");
        }
        lines.push("");
        break;
      }

      case "subagent.started": {
        const agentName = event.data.agentName as string;
        const agentDisplayName = event.data.agentDisplayName as string;
        lines.push("```");
        lines.push(`subagent.started: ${agentDisplayName || agentName}`);
        lines.push("```");
        lines.push("");
        break;
      }

      case "subagent.completed": {
        const agentName = event.data.agentName as string;
        lines.push("```");
        lines.push(`subagent.completed: ${agentName}`);
        lines.push("```");
        lines.push("");
        break;
      }

      case "subagent.failed": {
        const agentName = event.data.agentName as string;
        const error = event.data.error as string;
        let errorMsg = error || "unknown error";
        if (errorMsg.length > 500) {
          errorMsg = errorMsg.substring(0, 500) + "... (truncated)";
        }
        lines.push("```");
        lines.push(`subagent.failed: ${agentName}`);
        lines.push(`error: ${errorMsg}`);
        lines.push("```");
        lines.push("");
        break;
      }

      case "session.error": {
        const message = event.data.message as string;
        const errorType = event.data.errorType as string;
        lines.push("```");
        lines.push(`session.error: ${errorType || "unknown"}`);
        lines.push(`message: ${message || "unknown error"}`);
        lines.push("```");
        lines.push("");
        break;
      }
    }
  }

  return lines.join("\n");
}

/**
 * Write markdown report to file
 */
function writeMarkdownReport(config: TestConfig, agentMetadata: AgentMetadata): void {
  try {
    const filePath = buildShareFilePath();
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = generateMarkdownReport(config, agentMetadata);
    fs.writeFileSync(filePath, markdown, "utf-8");

    if (process.env.DEBUG) {
      console.log(`Markdown report written to: ${filePath}`);
    }
  } catch (error) {
    // Don't fail the test if report generation fails
    if (process.env.DEBUG) {
      console.error("Failed to write markdown report:", error);
    }
  }
}

/**
 * Run an agent session with the given configuration
 */
export async function run(config: TestConfig): Promise<AgentMetadata> {
  const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "skill-test-"));

  // Declare client and session outside try block to ensure cleanup in finally
  let client: CopilotClient | undefined;
  let session: CopilotSession | undefined;
  // Flag to prevent processing events after completion
  let isComplete = false;

  try {
    // Run optional setup
    if (config.setup) {
      await config.setup(testWorkspace);
    }

    // Copilot client with yolo mode
    const cliArgs: string[] = config.nonInteractive ? ["--yolo"] : [];
    if (process.env.DEBUG) {
      cliArgs.push("--log-dir");
      cliArgs.push(buildLogFilePath());
    }

    client = new CopilotClient({
      logLevel: process.env.DEBUG ? "all" : "error",
      cwd: testWorkspace,
      cliArgs: cliArgs,
    }) as CopilotClient;

    const skillDirectory = path.resolve(__dirname, "../../plugin/skills");

    session = await client.createSession({
      model: "claude-sonnet-4.5",
      skillDirectories: [skillDirectory],
      mcpServers: {
        azure: {
          type: "stdio",
          command: "npx",
          args: ["-y", "@azure/mcp", "server", "start"],
          tools: ["*"]
        }
      },
      systemMessage: config.systemPrompt
    });

    const agentMetadata: AgentMetadata = { events: [] };

    const done = new Promise<void>((resolve) => {
      session!.on(async (event: SessionEvent) => {
        // Stop processing events if already complete
        if (isComplete) {
          return;
        }

        if (process.env.DEBUG) {
          console.log(`=== session event ${event.type}`);
        }

        if (event.type === "session.idle") {
          isComplete = true;
          resolve();
          return;
        }

        // Capture all events
        agentMetadata.events.push(event);

        // Check for early termination
        if (config.shouldEarlyTerminate) {
          if (config.shouldEarlyTerminate(agentMetadata)) {
            isComplete = true;
            resolve();
            void session!.abort();
            return;
          }
        }
      });
    });

    await session.send({ prompt: config.prompt });
    await done;

    // Send follow-up prompts
    for (const followUpPrompt of config.followUp ?? []) {
      isComplete = false;
      await session.sendAndWait({ prompt: followUpPrompt });
    }

    // Generate markdown report
    writeMarkdownReport(config, agentMetadata);

    return agentMetadata;
  } catch (error) {
    // Mark as complete to stop event processing
    isComplete = true;
    console.error("Agent runner error:", error);
    throw error;
  } finally {
    // Mark as complete before starting cleanup to prevent post-completion event processing
    isComplete = true;
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
      if (!config.preserveWorkspace) {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      }
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
    .filter(event => event.type === "tool.execution_start")
    .filter(event => event.data.toolName === "skill")
    .some(event => {
      const args = event.data.arguments;
      return JSON.stringify(args).includes(skillName);
    });
}

/**
 * Check if all tool calls for a given tool were successful
 */
export function areToolCallsSuccess(agentMetadata: AgentMetadata, toolName?: string): boolean {
  let executionStartEvents = agentMetadata.events
    .filter(event => event.type === "tool.execution_start");

  if (toolName) {
    executionStartEvents = executionStartEvents
      .filter(event => event.data.toolName === toolName);
  }

  const executionCompleteEvents = agentMetadata.events
    .filter(event => event.type === "tool.execution_complete");

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
    if (event.type === "assistant.message" && event.data.messageId && event.data.content) {
      allMessages[event.data.messageId] = event.data.content;
    }
    if (event.type === "assistant.message_delta" && event.data.messageId) {
      if (allMessages[event.data.messageId]) {
        allMessages[event.data.messageId] += event.data.deltaContent ?? "";
      } else {
        allMessages[event.data.messageId] = event.data.deltaContent ?? "";
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
export function getToolCalls(agentMetadata: AgentMetadata, toolName?: string): SessionEvent[] {
  let calls = agentMetadata.events.filter(event => event.type === "tool.execution_start");

  if (toolName) {
    calls = calls.filter(event => event.data.toolName === toolName);
  }

  return calls;
}

// Track skip reason for reporting
let integrationSkipReason: string | undefined;

/**
 * Check if integration tests should be skipped
 * 
 * Integration tests are skipped when:
 * - SKIP_INTEGRATION_TESTS=true is set
 * - @github/copilot-sdk is not installed
 */
export function shouldSkipIntegrationTests(): boolean {
  // Skip if explicitly requested
  if (process.env.SKIP_INTEGRATION_TESTS === "true") {
    integrationSkipReason = "SKIP_INTEGRATION_TESTS=true";
    return true;
  }

  // Check if SDK package exists
  try {
    const sdkPath = path.join(__dirname, "..", "node_modules", "@github", "copilot-sdk", "package.json");
    if (!fs.existsSync(sdkPath)) {
      integrationSkipReason = "@github/copilot-sdk not installed";
      return true;
    }
  } catch {
    integrationSkipReason = "@github/copilot-sdk not installed";
    return true;
  }

  return false;
}

/**
 * Get the reason why integration tests are being skipped
 */
export function getIntegrationSkipReason(): string | undefined {
  return integrationSkipReason;
}

/**
 * Common Azure deployment link patterns
 * Patterns ensure the domain ends properly to prevent matching evil.com/azurewebsites.net or similar
 */
const DEPLOY_LINK_PATTERNS = [
  // Azure App Service URLs (matches domain followed by path, query, fragment, whitespace, or punctuation)
  /https?:\/\/[\w.-]+\.azurewebsites\.net(?=[/\s?#)\]]|$)/i,
  // Azure Static Web Apps URLs
  /https:\/\/[\w.-]+\.azurestaticapps\.net(?=[/\s?#)\]]|$)/i,
  // Azure Container Apps URLs
  /https:\/\/[\w.-]+\.azurecontainerapps\.io(?=[/\s?#)\]]|$)/i
];

/**
 * Get all assistant messages from agent metadata
 */
function getAllAssistantMessages(agentMetadata: AgentMetadata): string {
  const allMessages: Record<string, string> = {};

  agentMetadata.events.forEach(event => {
    if (event.type === "assistant.message" && event.data.messageId && event.data.content) {
      allMessages[event.data.messageId] = event.data.content;
    }
    if (event.type === "assistant.message_delta" && event.data.messageId) {
      if (allMessages[event.data.messageId]) {
        allMessages[event.data.messageId] += event.data.deltaContent ?? "";
      } else {
        allMessages[event.data.messageId] = event.data.deltaContent ?? "";
      }
    }
  });

  return Object.values(allMessages).join("\n");
}

/**
 * Check if the agent response contains any Azure deployment links
 */
export function hasDeployLinks(agentMetadata: AgentMetadata): boolean {
  const content = getAllAssistantMessages(agentMetadata);

  return DEPLOY_LINK_PATTERNS.some(pattern => pattern.test(content));
}

const DEFAULT_REPORT_DIR = path.join(__dirname, "..", "reports");
const TIME_STAMP = (process.env.START_TIMESTAMP || new Date().toISOString()).replace(/[:.]/g, "-");

export function buildShareFilePath(): string {
  return path.join(DEFAULT_REPORT_DIR, `test-run-${TIME_STAMP}`, getTestName(), `agent-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
}

export function buildLogFilePath(): string {
  return path.join(DEFAULT_REPORT_DIR, `test-run-${TIME_STAMP}`, getTestName());
}

function getTestName(): string {
  try {
    // Jest provides expect.getState() with current test info
    const state = expect.getState();
    const testName = state.currentTestName ?? "unknown-test";
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
    .replace(/[<>:"/\\|?*]/g, "-") // Replace invalid chars
    .replace(/\s+/g, "_")           // Replace spaces with underscores
    .replace(/-+/g, "-")            // Collapse multiple dashes
    .replace(/_+/g, "_")            // Collapse multiple underscores
    .replace(/_-_/g, "-")
    .substring(0, 200);             // Limit length
}