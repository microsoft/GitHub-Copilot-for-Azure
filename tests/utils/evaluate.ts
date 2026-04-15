import * as fs from "fs";
import * as path from "path";
import { type AgentMetadata } from "./agent-runner";

const SHELL_TOOL_NAMES = ["powershell", "bash"];

/**
 * Extract all shell command strings (powershell and bash) from agent metadata.
 */
function getShellCommands(metadata: AgentMetadata): string[] {
  return getToolCalls(metadata)
    .filter(event => SHELL_TOOL_NAMES.includes(event.data.toolName))
    .map(event => {
      const data = event.data as Record<string, unknown>;
      const args = data.arguments as { command?: string } | undefined;
      return args?.command ?? "";
    });
}

/**
 * Check whether any shell command executed by the agent matches
 * the given pattern.
 */
export function matchesCommand(metadata: AgentMetadata, pattern: RegExp): boolean {
  return getShellCommands(metadata).some(cmd => pattern.test(cmd));
}

/**
 * Scans files as text in the given workspace and checks whether there is text content matching the value pattern.
 * node_modules/ folders are always skipped because they are too easy to be accidentally included and usually will clog the execution.
 * @param workspace Path to a directory containing the files of interest.
 * @param valuePattern The value pattern to match the text files
 * @param filePattern If provided, only files whose names match the pattern are considered
 * @returns True if any file contains content matching the value pattern
 */
export function doesWorkspaceFileIncludePattern(workspace: string, valuePattern: RegExp, filePattern?: RegExp): boolean {
  const scanDirectory = (dir: string): boolean => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        if (scanDirectory(fullPath)) return true;
      } else if (entry.isFile()) {
        // Skip if filePattern is provided and doesn't match
        if (filePattern && !entry.name.match(filePattern)) {
          continue;
        }
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.match(valuePattern)) {
            return true;
          }
        } catch {
          // Skip files that can't be read as text
        }
      }
    }
    return false;
  };

  return scanDirectory(workspace);
}

/**
 * Recursively list all files under a directory, returning paths relative to the root.
 * Paths are normalized to use forward slashes for cross-platform regex matching.
 */
export function listFilesRecursive(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true })
    .map(p => path.join(dir, String(p)).replace(/\\/g, "/"));
}

/**
 * Check if any file in the list matches the given regex pattern.
 */
function hasFile(files: string[], pattern: RegExp): boolean {
  return files.some(f => pattern.test(f));
}

/**
 * List files in a workspace, log them, and assert expected/unexpected file patterns.
 */
export function expectFiles(
  workspacePath: string,
  expected: RegExp[],
  unexpected: RegExp[],
): void {
  const files = listFilesRecursive(workspacePath);

  for (const pattern of expected) {
    expect(hasFile(files, pattern)).toBe(true);
  }
  for (const pattern of unexpected) {
    expect(hasFile(files, pattern)).toBe(false);
  }
}

// ─── Agent metadata helpers ──────────────────────────────────────────────────

/**
 * Check if a skill was invoked during the session
 */
export function isSkillInvoked(metadata: AgentMetadata, skillName: string): boolean {
  return metadata.events
    .filter(event => event.type === "tool.execution_start")
    .filter(event => event.data.toolName === "skill")
    .some(event => {
      const args = event.data.arguments;
      return JSON.stringify(args).includes(skillName);
    });
}

/**
 * Normalize serialized tool arguments so Windows paths are comparable with slash-based regexes
 */
function normalizeToolArgumentText(argumentsData: unknown): string {
  return JSON.stringify(argumentsData ?? {})
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

/**
 * Check whether a tool was called and its serialized arguments match the given pattern
 */
export function isToolCalled(metadata: AgentMetadata, toolName: string, argumentPattern: RegExp): boolean {
  return getToolCalls(metadata, toolName).some(event => {
    const argsText = normalizeToolArgumentText(event.data.arguments);
    return argumentPattern.test(argsText);
  });
}

export function softCheckSkill(agentMetadata: AgentMetadata, skillName: string): void {
  const isSkillUsed = isSkillInvoked(agentMetadata, skillName);

  if (!isSkillUsed) {
    agentMetadata.testComments.push(`⚠️ ${skillName} skill was expected to be used but was not used.`);
  }
}

/**
 * Get all assistant messages from agent metadata
 */
export function getAllAssistantMessages(agentMetadata: AgentMetadata): string {
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

/** Stringify tool call arguments safely */
export function argsString(event: { data: Record<string, unknown> }): string {
  try {
    return JSON.stringify(event.data.arguments ?? {});
  } catch {
    return String(event.data.arguments);
  }
}

/**
 * Get all tool calls made during the session
 */
export function getToolCalls(agentMetadata: AgentMetadata, toolName?: string): Array<{
  id: string;
  timestamp: string;
  parentId: string | null;
  ephemeral?: boolean;
  type: "tool.execution_start";
  data: {
    toolCallId: string;
    toolName: string;
    arguments?: unknown;
    mcpServerName?: string;
    mcpToolName?: string;
    parentToolCallId?: string;
  };
}> {
  let calls = agentMetadata.events.filter(event => event.type === "tool.execution_start");

  if (toolName) {
    calls = calls.filter(event => event.data.toolName === toolName);
  }

  return calls;
}

/** Get combined text of all tool args and results for scanning */
export function getAllToolText(metadata: AgentMetadata): string {
  const parts: string[] = [];
  for (const event of metadata.events) {
    if (event.type === "tool.execution_start") {
      parts.push(argsString(event));
    }
    if (event.type === "tool.execution_complete") {
      const result = event.data.result as { content?: string } | undefined;
      if (result?.content) parts.push(result.content);
      const error = event.data.error as { message?: string } | undefined;
      if (error?.message) parts.push(error.message);
    }
  }
  return parts.join("\n");
}

/**
 * Check if an MCP tool was called from a specific server
 */
export function isMcpToolCalled(metadata: AgentMetadata, mcpServerName: string, mcpToolNamePattern?: RegExp): boolean {
  return metadata.events
    .filter(event => event.type === "tool.execution_start")
    .some(event => {
      const data = event.data as {
        mcpServerName?: string;
        mcpToolName?: string;
      };

      if (data.mcpServerName !== mcpServerName) {
        return false;
      }

      // If pattern specified, require tool name to exist and match
      if (mcpToolNamePattern) {
        if (!data.mcpToolName) {
          return false;
        }
        return mcpToolNamePattern.test(data.mcpToolName);
      }

      return true; // Server matches, no tool name pattern specified
    });
}

/**
 * Search for a keyword in both assistant messages AND tool execution data (reasoning)
 */
export function doesAssistantOrToolsIncludeKeyword(
  metadata: AgentMetadata,
  keyword: string,
  options: { caseSensitive?: boolean } = {}
): boolean {
  const searchText = options.caseSensitive
    ? keyword
    : keyword.toLowerCase();

  // Check assistant messages
  const messages = getAllAssistantMessages(metadata);
  const messageText = options.caseSensitive ? messages : messages.toLowerCase();
  if (messageText.includes(searchText)) {
    return true;
  }

  // Check tool calls and results (reasoning data)
  const toolText = getAllToolText(metadata);
  const toolSearchText = options.caseSensitive ? toolText : toolText.toLowerCase();
  return toolSearchText.includes(searchText);
}

/**
 * Maximum number of tool calls allowed before invoking the expected skill.
 * If more than this number of tool calls are made before invoking the expected skill,
 * we consider the agent failed to invoke the skill.
 */
const maxToolCallBeforeSkillInvocationTerminate = 3;

/**
 * Helper context passed to the test function inside `withTestResult`.
 */
interface WithTestResultContext {
  setSkillInvocationRate: (rate: number) => void;
}

/**
 * Wraps a test case function and automatically records the result via `global.addTestResult`.
 * If the function completes without throwing, `isPass` is `true`; otherwise `false`.
 * The test function receives a context object with `setSkillInvocationRate` to optionally
 * report the skill invocation rate in the recorded test result data.
 */
export async function withTestResult(fn: (ctx: WithTestResultContext) => Promise<void> | void): Promise<void> {
  let skillInvocationRate: number | undefined;

  const ctx: WithTestResultContext = {
    setSkillInvocationRate: (rate: number) => {
      skillInvocationRate = rate;
    },
  };

  try {
    await fn(ctx);
    global.addTestResult({ isPass: true, skillInvocationRate });
  } catch (e) {
    let message: string | undefined;
    if (e instanceof Error) {
      const raw = e.stack ?? e.message ?? String(e);
      message = raw?.slice(0, 4096);
    } else {
      message = String(e).slice(0, 4096);
    }
    global.addTestResult({ isPass: false, message, skillInvocationRate });
    throw e;
  }
}

export function shouldEarlyTerminateForSkillInvocation(agentMetadata: AgentMetadata, skillName: string): boolean {
  const shouldEarlyTerminateForInvokedSkill = isSkillInvoked(agentMetadata, skillName);
  if (shouldEarlyTerminateForInvokedSkill) {
    const earlyTerminateComment = `✅ ${skillName} is invoked as expected. Terminating the agent run early.`;
    // Due to follow up mechanism, we may run the agent twice and trigger the early terminate condition twice.
    // Check if a comment has been made to avoid adding redundant comment.
    if (!agentMetadata.testComments.some((comment) => comment === earlyTerminateComment)) {
      agentMetadata.testComments.push(earlyTerminateComment);
    }
    return true;
  }

  const shouldEarlyTerminateForTooLate = getToolCalls(agentMetadata).length > maxToolCallBeforeSkillInvocationTerminate;
  if (shouldEarlyTerminateForTooLate) {
    agentMetadata.testComments.push(`⚠️ ${skillName} is not invoked within early tool calls. Terminating the agent run early.`);
    return true;
  }
  return false;
}