import { type AgentMetadata } from "./agent-runner.ts";

/**
 * Strip content that is not actually executed as shell commands.
 * Removes bash heredoc bodies, shell comments, and PowerShell here-strings
 * so that pattern matching only hits real commands.
 */
export function stripNonExecutableContent(command: string): string {
  const lines = command.split("\n");
  const result: string[] = [];
  let heredocDelimiter: string | null = null;
  let heredocAllowTabs = false;
  let psHereStringCloser: string | null = null;

  for (const line of lines) {
    // Inside a bash heredoc — skip until closing delimiter.
    // For `<<`, the delimiter must appear at column 0 with no surrounding whitespace.
    // For `<<-`, only leading tabs are stripped before matching.
    if (heredocDelimiter !== null) {
      const closerLine = heredocAllowTabs ? line.replace(/^\t+/, "") : line;
      if (closerLine === heredocDelimiter) {
        heredocDelimiter = null;
      }
      continue;
    }

    // Inside a PowerShell here-string — skip until closing marker.
    // PowerShell requires the closer ('@ or "@) at column 0, but may have
    // trailing content on the same line (e.g., '@ + "extra").
    if (psHereStringCloser !== null) {
      if (line.startsWith(psHereStringCloser)) {
        psHereStringCloser = null;
      }
      continue;
    }

    // Skip shell comment lines before heredoc detection to prevent
    // commented examples like `# cat <<EOF` from entering heredoc mode
    if (/^\s*#[^!]/.test(line) || /^\s*#$/.test(line)) {
      continue;
    }

    // Detect bash heredoc opener: << or <<- followed by optional quotes around delimiter
    const heredocMatch = line.match(/<<(-?)\s*['"]?([A-Za-z_][\w-]*)['"]?/);
    if (heredocMatch) {
      heredocAllowTabs = heredocMatch[1] === "-";
      heredocDelimiter = heredocMatch[2];
      // Keep the portion of the line before the heredoc (e.g., `cat > file`)
      result.push(line.substring(0, line.indexOf("<<")));
      continue;
    }

    // Detect PowerShell here-string openers: @' or @" (may appear mid-line after =)
    const psMatch = line.match(/@(['"])\s*$/);
    if (psMatch) {
      psHereStringCloser = `${psMatch[1]}@`;
      // Keep the portion before the here-string opener
      result.push(line.substring(0, line.indexOf("@" + psMatch[1])));
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

// ─── Agent metadata helpers ──────────────────────────────────────────────────

/**
 * Check if a skill was invoked during the session
 */
export function isSkillInvoked(metadata: AgentMetadata, skillName: string): boolean {
  return metadata.events
    .filter(event => event.type === "skill.invoked")
    .some(event => event.data.name === skillName);
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
