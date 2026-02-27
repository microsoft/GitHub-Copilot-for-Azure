import * as fs from "fs";
import * as path from "path";
import { type AgentMetadata } from "./agent-runner";

/**
 * Extract all powershell command strings from agent metadata.
 */
function getPowershellCommands(metadata: AgentMetadata): string[] {
    return getToolCalls(metadata, "powershell").map(event => {
        const data = event.data as Record<string, unknown>;
        const args = data.arguments as { command?: string } | undefined;
        return args?.command ?? "";
    });
}

/**
 * Check whether any powershell command executed by the agent matches
 * the given pattern.
 */
export function matchesCommand(metadata: AgentMetadata, pattern: RegExp): boolean {
    return getPowershellCommands(metadata).some(cmd => pattern.test(cmd));
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
export function hasFile(files: string[], pattern: RegExp): boolean {
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

/** Get all tool execution results (complete events) */
export function getToolResults(metadata: AgentMetadata): Array<{
    toolCallId: string;
    success: boolean;
    content: string;
    error: string;
}> {
    return metadata.events
        .filter(e => e.type === "tool.execution_complete")
        .map(e => ({
            toolCallId: e.data.toolCallId as string,
            success: e.data.success as boolean,
            content: (e.data.result as { content?: string })?.content ?? "",
            error: (e.data.error as { message?: string })?.message ?? ""
        }));
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