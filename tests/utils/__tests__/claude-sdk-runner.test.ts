import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { convertToTrajectoryEvents } from "../agent-runner.ts";
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
          usage: usage({
            inputTokens: 2,
            outputTokens: 5,
            cacheWriteTokens: 43993,
          }),
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
      path: path.join("/plugins/azure-skills/skills/azure-ai", "SKILL.md"),
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
        normalizePath(path.join(mocks.skillsDirectory, "azure-ai", "SKILL.md")),
        normalizePath(path.join(mocks.skillsDirectory, "azure-ai", "references", "search.md")),
      ],
    });
    expect(metadata.tokenUsage).toEqual({
      inputTokens: 2,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 43993,
      totalApiDurationMs: 0,
      apiCallCount: 4,
      model: "claude-sonnet-5",
      perCallUsage: [
        {
          model: "claude-sonnet-5",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          durationMs: 0,
          initiator: "message-1",
        },
        {
          model: "claude-sonnet-5",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          durationMs: 0,
          initiator: "message-2",
        },
        {
          model: "claude-sonnet-5",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          durationMs: 0,
          initiator: "message-3",
        },
        {
          model: "claude-sonnet-5",
          inputTokens: 2,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 43993,
          durationMs: 0,
          initiator: "message-4",
        },
      ],
    });
    const trajectoryEvents = convertToTrajectoryEvents(metadata);
    const skillActivations = trajectoryEvents.filter(
      event => event.type === "skill_activation",
    );
    expect(skillActivations).toHaveLength(1);
    expect(skillActivations[0].data).toMatchObject({
      name: "azure-ai",
      path: path.join("/plugins/azure-skills/skills/azure-ai", "SKILL.md"),
    });
    expect(
      trajectoryEvents.some(event =>
        event.type === "token_usage"
        && ((event.data.inputTokens ?? 0) > 0 || (event.data.outputTokens ?? 0) > 0)),
    ).toBe(true);
    expect(metadata.events[0].id).toBe("init-1");
    expect(metadata.events[0].timestamp).toBe("1970-01-01T00:00:00.000Z");
    expect(metadata.events.at(-1)?.type).toBe("assistant.turn_end");
    expect(metadata.events.at(-1)?.id).toBe("result-1");
  });

  test("reports assistant usage when the run is early terminated", async () => {
    const messages = [
      {
        type: "system",
        subtype: "init",
        session_id: "session-1",
        uuid: "init-1",
        claude_code_version: "2.1.287",
        model: "claude-sonnet-5",
        mcp_servers: [],
      },
      {
        type: "assistant",
        uuid: "assistant-1",
        session_id: "session-1",
        parent_tool_use_id: null,
        message: {
          id: "message-1",
          model: "claude-sonnet-5",
          role: "assistant",
          content: [{ type: "text", text: "Ready to stop" }],
          usage: usage({
            inputTokens: 3,
            outputTokens: 7,
            cacheReadTokens: 100,
            cacheWriteTokens: 200,
          }),
        },
      },
    ] as unknown as SDKMessage[];
    mocks.query.mockReturnValue(toAsyncIterable(messages));

    const runner = useClaudeAgentRunner({ testName: "early-termination" });
    const metadata = await runner.run({
      model: "claude-sonnet-5",
      prompt: "Stop after the first response.",
      shouldEarlyTerminate: currentMetadata =>
        currentMetadata.events.some(event => event.type === "assistant.message"),
    });

    expect(metadata.tokenUsage).toMatchObject({
      inputTokens: 3,
      outputTokens: 7,
      cacheReadTokens: 100,
      cacheWriteTokens: 200,
      totalApiDurationMs: 0,
      apiCallCount: 1,
      model: "claude-sonnet-5",
    });
  });

  test("uses the latest cumulative usage snapshot for each assistant message", async () => {
    const messages = [
      {
        type: "system",
        subtype: "init",
        session_id: "session-1",
        uuid: "init-1",
        claude_code_version: "2.1.287",
        model: "claude-sonnet-5",
        mcp_servers: [],
      },
      {
        type: "assistant",
        uuid: "assistant-thinking",
        session_id: "session-1",
        parent_tool_use_id: null,
        message: {
          id: "message-1",
          model: "claude-sonnet-5",
          role: "assistant",
          content: [{ type: "thinking", thinking: "Working", signature: "signature" }],
          usage: usage({
            inputTokens: 2,
            outputTokens: 3,
          }),
        },
      },
      {
        type: "assistant",
        uuid: "assistant-text",
        session_id: "session-1",
        parent_tool_use_id: null,
        message: {
          id: "message-1",
          model: "claude-sonnet-5",
          role: "assistant",
          content: [{ type: "text", text: "Done" }],
          usage: usage({
            inputTokens: 2,
            outputTokens: 5,
          }),
        },
      },
    ] as unknown as SDKMessage[];
    mocks.query.mockReturnValue(toAsyncIterable(messages));

    const runner = useClaudeAgentRunner({ testName: "usage-snapshots" });
    const metadata = await runner.run({
      model: "claude-sonnet-5",
      prompt: "Complete the task.",
    });

    expect(metadata.tokenUsage).toMatchObject({
      inputTokens: 2,
      outputTokens: 5,
      apiCallCount: 1,
      perCallUsage: [
        {
          model: "claude-sonnet-5",
          inputTokens: 2,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          durationMs: 0,
          initiator: "message-1",
        },
      ],
    });
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
      usage: usage(),
    },
  };
}

function usage({
  inputTokens = 0,
  outputTokens = 0,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
}: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
} = {}): object {
  return {
    cache_creation: {
      ephemeral_1h_input_tokens: 0,
      ephemeral_5m_input_tokens: cacheWriteTokens,
    },
    cache_creation_input_tokens: cacheWriteTokens,
    cache_read_input_tokens: cacheReadTokens,
    inference_geo: "global",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
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

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}
