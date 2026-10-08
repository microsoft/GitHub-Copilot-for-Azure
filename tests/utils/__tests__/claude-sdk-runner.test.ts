import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useClaudeAgentRunner } from "../claude-sdk-runner.ts";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  skillsDirectory: `${(process.env.TMPDIR ?? process.env.TEMP ?? "/tmp").replace(/[\\/]+$/u, "")}/claude-sdk-runner-skills-${process.pid}`,
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: mocks.query,
}));

vi.mock("../skill-loader.ts", () => ({
  getSkillsForTest: vi.fn().mockResolvedValue({
    skillDirectories: [mocks.skillsDirectory],
    skillsLoaded: [{ name: "azure-ai" }],
  }),
}));

describe("claude-sdk-runner", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    fs.mkdirSync(path.join(mocks.skillsDirectory, "azure-ai"), { recursive: true });
    fs.writeFileSync(path.join(mocks.skillsDirectory, "azure-ai", "SKILL.md"), "# Azure AI");
  });

  afterEach(() => {
    fs.rmSync(mocks.skillsDirectory, { recursive: true, force: true });
  });

  test("translates skill, reference read, and MCP tool messages", async () => {
    const messages = [
      {
        type: "system",
        subtype: "init",
        session_id: "session-1",
        uuid: "init-1",
        claude_code_version: "2.1.287",
        model: "claude-sonnet-5",
        mcp_servers: [{ name: "plugin:azure:azure", status: "pending" }],
      },
      assistantToolMessage("message-1", "skill-call", "Skill", {
        skill: "azure:azure-ai",
      }),
      toolResultMessage("skill-result", "skill-call", "Launching skill: azure:azure-ai"),
      userTextMessage(
        "skill-content",
        "Base directory for this skill: /plugins/azure-skills/skills/azure-ai\n\n# Azure AI Services",
      ),
      assistantToolMessage("message-2", "read-call", "Read", {
        file_path: path.join(mocks.skillsDirectory, "azure-ai", "references", "search.md"),
      }),
      toolResultMessage("read-result", "read-call", "reference contents"),
      assistantToolMessage(
        "message-3",
        "mcp-call",
        "mcp__plugin_azure_azure__search",
        { learn: true },
      ),
      toolResultMessage("mcp-result", "mcp-call", [
        { type: "text", text: "MCP response" },
      ]),
      {
        type: "assistant",
        uuid: "assistant-final",
        session_id: "session-1",
        parent_tool_use_id: null,
        message: {
          id: "message-4",
          model: "claude-sonnet-5",
          role: "assistant",
          content: [{ type: "text", text: "Done" }],
        },
      },
      {
        type: "result",
        subtype: "success",
        uuid: "result-1",
        session_id: "session-1",
        is_error: false,
        result: "Done",
        duration_api_ms: 13460,
        num_turns: 5,
        usage: {
          input_tokens: 8,
          output_tokens: 1019,
          cache_read_input_tokens: 144136,
          cache_creation_input_tokens: 118482,
        },
        modelUsage: {
          "claude-sonnet-5": {
            inputTokens: 1231,
            outputTokens: 1039,
          },
        },
      },
    ] as unknown as SDKMessage[];
    mocks.query.mockReturnValue(toAsyncIterable(messages));

    const runner = useClaudeAgentRunner({ testName: "translation" });
    const metadata = await runner.run({
      model: "claude-sonnet-5",
      prompt: "Load the skill, read a reference, and invoke Azure MCP.",
    });

    const skillEvent = metadata.events.find(event => event.type === "skill.invoked");
    expect(skillEvent?.id).toBe("skill-content");
    expect(skillEvent?.data).toMatchObject({
      name: "azure-ai",
      path: "/plugins/azure-skills/skills/azure-ai/SKILL.md",
      content: "# Azure AI Services",
      pluginName: "azure",
      source: "plugin",
      trigger: "agent-invoked",
    });

    const toolStarts = metadata.events.filter(event => event.type === "tool.execution_start");
    expect(toolStarts.map(event => event.id)).toEqual([
      "skill-call-message",
      "read-call-message",
      "mcp-call-message",
    ]);
    expect(toolStarts.map(event => event.data.toolName)).toEqual([
      "skill",
      "read",
      "azure-search",
    ]);
    expect(toolStarts[0].data.arguments).toEqual({ skill: "azure-ai" });
    expect(toolStarts[2].data).toMatchObject({
      mcpConfigServerName: "plugin:azure:azure",
      mcpServerName: "plugin:azure:azure",
      mcpToolName: "search",
    });
    expect(toolStarts[2].timestamp).toBe("2026-01-01T00:00:01.000Z");

    const toolCompletions = metadata.events
      .filter(event => event.type === "tool.execution_complete");
    expect(toolCompletions.map(event => event.id)).toEqual([
      "skill-result",
      "read-result",
      "mcp-result",
    ]);
    expect(toolCompletions).toHaveLength(3);
    expect(toolCompletions[2].data).toMatchObject({
      toolCallId: "mcp-call",
      success: true,
      result: {
        content: "MCP response",
        detailedContent: "MCP response",
      },
    });
    expect(toolCompletions[2].timestamp).toBe("2026-01-01T00:00:02.000Z");

    expect(metadata.events.filter(event => event.type === "user.message")).toHaveLength(0);
    expect(metadata.toolCounts).toEqual({
      read: 1,
      "azure-search": 1,
    });
    expect(metadata.skillFiles).toEqual({
      "azure-ai": [
        path.join(mocks.skillsDirectory, "azure-ai", "SKILL.md"),
        path.join(mocks.skillsDirectory, "azure-ai", "references", "search.md"),
      ],
    });
    expect(metadata.tokenUsage).toEqual({
      inputTokens: 8,
      outputTokens: 1019,
      cacheReadTokens: 144136,
      cacheWriteTokens: 118482,
      totalApiDurationMs: 13460,
      apiCallCount: 5,
      model: "claude-sonnet-5",
      perCallUsage: [],
    });
    expect(metadata.events[0].id).toBe("init-1");
    expect(metadata.events[0].timestamp).toBe("1970-01-01T00:00:00.000Z");
    expect(metadata.events.at(-1)?.type).toBe("assistant.turn_end");
    expect(metadata.events.at(-1)?.id).toBe("result-1");
  });
});

function assistantToolMessage(
  messageId: string,
  toolCallId: string,
  name: string,
  input: Record<string, unknown>,
): unknown {
  return {
    type: "assistant",
    uuid: `${toolCallId}-message`,
    session_id: "session-1",
    timestamp: "2026-01-01T00:00:01.000Z",
    parent_tool_use_id: null,
    message: {
      id: messageId,
      model: "claude-sonnet-5",
      role: "assistant",
      content: [{ type: "tool_use", id: toolCallId, name, input }],
    },
  };
}

function toolResultMessage(uuid: string, toolUseId: string, content: unknown): unknown {
  return {
    type: "user",
    uuid,
    session_id: "session-1",
    timestamp: "2026-01-01T00:00:02.000Z",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
    },
  };
}

function userTextMessage(uuid: string, text: string): unknown {
  return {
    type: "user",
    uuid,
    session_id: "session-1",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [{ type: "text", text }],
    },
  };
}

async function* toAsyncIterable(messages: SDKMessage[]): AsyncGenerator<SDKMessage> {
  yield* messages;
}
