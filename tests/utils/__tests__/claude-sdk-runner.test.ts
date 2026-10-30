import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultSuccess,
  SDKSystemMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
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
import { convertToTrajectoryEvents, type AgentMetadata } from "../agent-runner.ts";
import * as agentRunner from "../agent-runner.ts";
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
    vi.restoreAllMocks();
    vi.useRealTimers();
    fs.rmSync(mocks.skillsDirectory, { recursive: true, force: true });
  });

  test("uses only the inner session timeout", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    mocks.query.mockReturnValue(toAsyncIterable([]));

    const runner = useClaudeAgentRunner({ testName: "session-timeout" });
    await runner.run({
      prompt: "Start the run.",
      timeout: 6 * 60 * 1000,
    });

    expect(setTimeoutSpy).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 6 * 60 * 1000);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0].value);
  });

  test.each([
    { maxTurns: undefined, expectedTurns: 4, aborted: false },
    { maxTurns: 0, expectedTurns: 1, aborted: true },
    { maxTurns: 1, expectedTurns: 2, aborted: true },
    { maxTurns: 2, expectedTurns: 3, aborted: true },
    { maxTurns: 3, expectedTurns: 4, aborted: false },
    { maxTurns: 4, expectedTurns: 4, aborted: false },
  ])("enforces maxTurns=$maxTurns on manually counted prompt turns", async ({
    maxTurns,
    expectedTurns,
    aborted,
  }) => {
    const prompts = ["Start.", "Continue.", "Continue again.", "Finish."];
    const streams = prompts.map((_, promptIndex) => Array.from({ length: 3 }, (_, eventTurn) => [
      initMessage(),
      assistantToolMessage(`message-${promptIndex}-${eventTurn}`, `read-${promptIndex}-${eventTurn}`, "Read", {
        file_path: path.join(mocks.skillsDirectory, "azure-ai", "SKILL.md"),
      }),
      resultMessage(),
    ]).flat());
    const streamClosed = vi.fn();
    for (const messages of streams) {
      mocks.query.mockReturnValueOnce((async function* () {
        try {
          yield* messages;
        } finally {
          streamClosed();
        }
      })());
    }
    const observedTurnCounts: number[] = [];

    const runner = useClaudeAgentRunner({ testName: "max-turns" });
    const metadata = await runner.run({
      prompt: prompts[0],
      followUp: prompts.slice(1),
      timeout: 30 * 1000,
      maxTurns,
      shouldEarlyTerminate: currentMetadata => {
        observedTurnCounts.push(currentMetadata.turnCount);
        return false;
      },
    });

    // The guard is checked before each prompt and aborts only after count > maxTurns.
    expect(mocks.query).toHaveBeenCalledTimes(expectedTurns);
    expect(mocks.query.mock.calls.map(([config]) => config.prompt)).toEqual(prompts.slice(0, expectedTurns));
    for (const [config] of mocks.query.mock.calls) {
      expect(config.options).not.toHaveProperty("maxTurns");
      expect(config.options.abortController.signal.aborted).toBe(aborted);
    }
    expect(mocks.query.mock.calls[0][0].options).not.toHaveProperty("resume");
    for (const [config] of mocks.query.mock.calls.slice(1)) {
      expect(config.options.resume).toBe("session-1");
    }
    expect(metadata.turnCount).toBe(expectedTurns);
    expect(observedTurnCounts).toEqual(
      streams.slice(0, expectedTurns).flatMap((messages, index) => messages.map(() => index)),
    );
    expect(metadata.rawData).toEqual(streams.slice(0, expectedTurns).flat());
    expect(metadata.toolCounts).toEqual({ read: expectedTurns * 3 });
    const starts = metadata.events.filter(event => event.type === "assistant.turn_start");
    const ends = metadata.events.filter(event => event.type === "assistant.turn_end");
    expect(starts).toHaveLength(expectedTurns * 3);
    expect(ends).toHaveLength(expectedTurns * 3);
    expect(starts.map(event => event.data.turnId)).toEqual(ends.map(event => event.data.turnId));
    expect(new Set(starts.map(event => event.data.turnId)).size).toBe(expectedTurns);
    expect(metadata.testComments).toEqual(aborted
      ? [`⚠️ Run aborted: turn count (${expectedTurns}) exceeded maxTurns (${maxTurns}).`]
      : []);
    expect(streamClosed).toHaveBeenCalledTimes(expectedTurns);
  });

  test("counts a prompt once even without SDK turn or tool-call messages", async () => {
    mocks.query.mockImplementation(() => toAsyncIterable([]));

    const runner = useClaudeAgentRunner({ testName: "empty-prompts" });
    const metadata = await runner.run({
      prompt: "Start.",
      followUp: ["Continue.", "Do not send."],
      maxTurns: 0,
      timeout: 30 * 1000,
    });

    expect(metadata.turnCount).toBe(1);
    expect(metadata.events).toEqual([]);
    expect(metadata.rawData).toBeUndefined();
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(metadata.testComments).toEqual([
      "⚠️ Run aborted: turn count (1) exceeded maxTurns (0).",
    ]);
  });

  test("translates init and result boundaries without injecting extra stream boundaries", async () => {
    const user = userTextMessage("Start.");
    const init = { ...initMessage(), timestamp: "2026-01-01T00:00:01.000Z" };
    const result = resultMessage();
    const afterResult = userTextMessage("A message after the result.");
    mocks.query.mockReturnValue(toAsyncIterable([user, init, result, afterResult]));

    const runner = useClaudeAgentRunner({ testName: "turn-boundaries" });
    const metadata = await runner.run({ prompt: "Start.", timeout: 30 * 1000 });

    expect(metadata.events.map(event => event.type)).toEqual([
      "user.message",
      "assistant.turn_start",
      "assistant.message",
      "assistant.turn_end",
      "user.message",
    ]);
    expect(metadata.events[1]).toEqual({
      type: "assistant.turn_start",
      id: init.uuid,
      parentId: user.uuid,
      timestamp: init.timestamp,
      data: { turnId: expect.any(String) },
    });
    expect(metadata.events[2]).toMatchObject({
      id: result.uuid,
      parentId: init.uuid,
      data: { content: result.result },
    });
    expect(metadata.events[3]).toMatchObject({
      id: `${result.uuid}:1`,
      parentId: result.uuid,
      timestamp: "1970-01-01T00:00:00.000Z",
      data: metadata.events[1].data,
    });
    expect(metadata.events[4].parentId).toBe(`${result.uuid}:1`);
    expect(new Set(metadata.events.map(event => event.id)).size).toBe(metadata.events.length);
    expect(metadata.turnCount).toBe(1);
    expect(metadata.testComments).toEqual([]);
  });

  test("emits only a turn end for a result when an assistant response already exists", async () => {
    const init = initMessage();
    const assistant = assistantMessage("message-1", [{ type: "text", text: "Done", citations: null }]);
    const result = { ...resultMessage(), timestamp: "2026-01-01T00:00:03.000Z" };
    mocks.query.mockReturnValue(toAsyncIterable([init, assistant, result]));

    const runner = useClaudeAgentRunner({ testName: "existing-assistant-result" });
    const metadata = await runner.run({ prompt: "Start.", timeout: 30 * 1000 });

    expect(metadata.events.filter(event => event.type === "assistant.message")).toHaveLength(1);
    expect(metadata.events.at(-1)).toMatchObject({
      type: "assistant.turn_end",
      id: result.uuid,
      parentId: assistant.uuid,
      timestamp: result.timestamp,
      data: metadata.events[0].data,
    });
    expect(metadata.testComments).toEqual([]);
  });

  test.each([
    "error_during_execution",
    "error_max_turns",
    "error_max_budget_usd",
    "error_max_structured_output_retries",
    "success",
  ] as const)("closes the turn after an error result with subtype %s", async (subtype) => {
    const init = initMessage();
    const result = subtype === "success"
      ? { ...resultMessage(), is_error: true, result: "Failed" }
      : { ...resultMessage(), subtype, is_error: true, errors: ["Failed", "Details"] };
    mocks.query.mockReturnValue(toAsyncIterable([init, result]));

    const runner = useClaudeAgentRunner({ testName: "error-result" });
    const metadata = await runner.run({ prompt: "Start.", timeout: 30 * 1000 });

    expect(metadata.events.map(event => event.type)).toEqual([
      "assistant.turn_start",
      "session.error",
      "assistant.turn_end",
    ]);
    expect(metadata.events[1]).toMatchObject({
      id: result.uuid,
      parentId: init.uuid,
      data: {
        errorType: subtype,
        message: subtype === "success" ? "Failed" : "Failed\nDetails",
      },
    });
    expect(metadata.events[2]).toMatchObject({
      id: `${result.uuid}:1`,
      parentId: result.uuid,
      data: metadata.events[0].data,
    });
    expect(metadata.turnCount).toBe(1);
    expect(metadata.testComments).toEqual([]);
  });

  test.each([false, true])("does not synthesize turn boundaries without init/result (init=%s)", async (withInit) => {
    const messages = [...withInit ? [initMessage()] : [], userTextMessage("Start.")];
    mocks.query.mockReturnValue(toAsyncIterable(messages));

    const runner = useClaudeAgentRunner({ testName: "unfinished-turn" });
    const metadata = await runner.run({ prompt: "Start.", timeout: 30 * 1000 });

    expect(metadata.events.map(event => event.type)).toEqual(withInit
      ? ["assistant.turn_start", "user.message"]
      : ["user.message"]);
    expect(metadata.turnCount).toBe(1);
    expect(metadata.testComments).toEqual([]);
  });

  test.each([new Error("query failed"), "query failed"])("returns metadata when query throws %s", async (error) => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => { });
    mocks.query.mockImplementation(() => {
      throw error;
    });

    const runner = useClaudeAgentRunner({ testName: "query-failure" });
    const metadata = await runner.run({
      prompt: "Start the run.",
      followUp: ["Do not send this prompt."],
      timeout: 30 * 1000,
    });

    expect(metadata.testComments).toEqual(["Agent runner error: query failed"]);
    expect(metadata.events).toEqual([]);
    expect(metadata.rawData).toBeUndefined();
    expect(metadata.turnCount).toBe(0);
    expect(metadata.toolCounts).toEqual({});
    expect(metadata.skillFiles).toEqual({});
    expect(metadata.skillsLoaded).toEqual([{ name: "azure-ai" }]);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith("Agent runner error:", "query failed");
    expect(fs.existsSync(mocks.query.mock.calls[0][0].options.cwd)).toBe(false);
  });

  test.each([false, true])("preserves collected data when a message stream fails (follow-up=%s)", async (isFollowUp) => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => { });
    const completedMessages = [initMessage(), resultMessage()];
    const partialMessages = [
      initMessage(),
      assistantToolMessage("message-1", "read-call", "Read", {
        file_path: path.join(mocks.skillsDirectory, "azure-ai", "SKILL.md"),
      }),
      toolResultMessage("read-call", "skill contents"),
    ];
    if (isFollowUp) {
      mocks.query.mockReturnValueOnce(toAsyncIterable(completedMessages));
    }
    const streamClosed = vi.fn();
    mocks.query.mockReturnValueOnce((async function* () {
      try {
        yield* partialMessages;
        throw new Error("stream failed");
      } finally {
        streamClosed();
      }
    })());

    const runner = useClaudeAgentRunner({ testName: "stream-failure" });
    const metadata = await runner.run({
      prompt: "Start the run.",
      followUp: [...isFollowUp ? ["Continue."] : [], "Do not send this prompt."],
      timeout: 30 * 1000,
    });

    expect(metadata.testComments).toEqual(["Agent runner error: stream failed"]);
    expect(metadata.rawData).toEqual([
      ...isFollowUp ? completedMessages : [],
      ...partialMessages,
    ]);
    expect(metadata.toolCounts).toEqual({ read: 1 });
    expect(metadata.turnCount).toBe(isFollowUp ? 1 : 0);
    expect(metadata.events.filter(event => event.type === "assistant.turn_end")).toHaveLength(isFollowUp ? 1 : 0);
    expect(metadata.events.at(-1)?.type).toBe("tool.execution_complete");
    expect(mocks.query).toHaveBeenCalledTimes(isFollowUp ? 2 : 1);
    expect(streamClosed).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith("Agent runner error:", "stream failed");
    expect(fs.existsSync(mocks.query.mock.calls.at(-1)![0].options.cwd)).toBe(false);
  });

  test("records unexpected errors before rethrowing without discarding collected data", async () => {
    const error = new Error("statistics failed");
    const logError = vi.spyOn(console, "error").mockImplementation(() => { });
    vi.spyOn(agentRunner, "computeToolAndSkillStats").mockImplementation(() => {
      throw error;
    });
    const message = assistantToolMessage("message-1", "read-call", "Read", {
      file_path: path.join(mocks.skillsDirectory, "azure-ai", "SKILL.md"),
    });
    mocks.query.mockReturnValue(toAsyncIterable([message]));
    let collectedMetadata: AgentMetadata | undefined;

    const runner = useClaudeAgentRunner({ testName: "unexpected-failure" });
    await expect(runner.run({
      prompt: "Start the run.",
      shouldEarlyTerminate: metadata => {
        collectedMetadata = metadata;
        return false;
      },
      timeout: 30 * 1000,
    })).rejects.toBe(error);

    expect(collectedMetadata?.testComments).toEqual(["Agent runner error: statistics failed"]);
    expect(collectedMetadata?.rawData).toEqual([message]);
    expect(collectedMetadata?.events.length).toBeGreaterThan(0);
    expect(logError).toHaveBeenCalledWith("Agent runner error:", "statistics failed");
  });

  test("translates skill, reference read, and MCP tool messages", async () => {
    const init = initMessage([{ name: "plugin:azure:azure", status: "pending" }]);
    const skill = assistantToolMessage("message-1", "skill-call", "Skill", { skill: "azure:azure-ai" });
    const skillResult = toolResultMessage("skill-call", "Launching skill: azure:azure-ai");
    const skillContent = userTextMessage(
      "Base directory for this skill: /plugins/azure-skills/skills/azure-ai\n\n# Azure AI Services",
    );
    const read = assistantToolMessage("message-2", "read-call", "Read", {
      file_path: path.join(mocks.skillsDirectory, "azure-ai", "references", "search.md"),
    });
    const readResult = toolResultMessage("read-call", "reference contents");
    const mcp = assistantToolMessage("message-3", "mcp-call", "mcp__plugin_azure_azure__search", { learn: true });
    const mcpResult = toolResultMessage("mcp-call", [{ type: "text", text: "MCP response" }]);
    const final = assistantMessage("message-4", [{ type: "text", text: "Done", citations: null }], usage({
      inputTokens: 2,
      outputTokens: 5,
      cacheWriteTokens: 43993,
    }));
    const result = resultMessage();
    const messages = [init, skill, skillResult, skillContent, read, readResult, mcp, mcpResult, final, result];
    mocks.query.mockReturnValue(toAsyncIterable(messages));

    const runner = useClaudeAgentRunner({ testName: "translation" });
    const metadata = await runner.run({
      model: "claude-sonnet-5",
      prompt: "Load the skill, read a reference, and invoke Azure MCP.",
      timeout: 30 * 1000,
    });

    const skillEvent = metadata.events.find(event => event.type === "skill.invoked");
    expect(skillEvent?.id).toBe(skillContent.uuid);
    expect(skillEvent?.data).toMatchObject({
      name: "azure-ai",
      path: path.join("/plugins/azure-skills/skills/azure-ai", "SKILL.md"),
      content: "# Azure AI Services",
      pluginName: "azure",
      source: "plugin",
      trigger: "agent-invoked",
    });

    const toolStarts = metadata.events.filter(event => event.type === "tool.execution_start");
    expect(toolStarts.map(event => event.id)).toEqual([skill.uuid, read.uuid, mcp.uuid]);
    expect(toolStarts.map(event => event.data.toolName)).toEqual(["skill", "read", "azure-search"]);
    expect(toolStarts[0].data.arguments).toEqual({ skill: "azure-ai" });
    expect(toolStarts[2].data).toMatchObject({
      mcpConfigServerName: "plugin:azure:azure",
      mcpServerName: "plugin:azure:azure",
      mcpToolName: "search",
    });
    expect(toolStarts[2].timestamp).toBe(mcp.timestamp);

    const toolCompletions = metadata.events.filter(event => event.type === "tool.execution_complete");
    expect(toolCompletions.map(event => event.id)).toEqual([skillResult.uuid, readResult.uuid, mcpResult.uuid]);
    expect(toolCompletions[2].data).toMatchObject({
      toolCallId: "mcp-call",
      success: true,
      result: { content: "MCP response", detailedContent: "MCP response" },
    });
    expect(toolCompletions[2].timestamp).toBe(mcpResult.timestamp);
    expect(metadata.events.filter(event => event.type === "user.message")).toHaveLength(0);
    expect(metadata.toolCounts).toEqual({ read: 1, "azure-search": 1 });
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
      perCallUsage: [skill, read, mcp, final].map(message => ({
        model: "claude-sonnet-5",
        inputTokens: message.message.usage.input_tokens,
        outputTokens: message.message.usage.output_tokens,
        cacheReadTokens: message.message.usage.cache_read_input_tokens,
        cacheWriteTokens: message.message.usage.cache_creation_input_tokens,
        durationMs: 0,
        initiator: message.message.id,
      })),
    });
    const trajectoryEvents = convertToTrajectoryEvents(metadata);
    const skillActivations = trajectoryEvents.filter(event => event.type === "skill_activation");
    expect(skillActivations).toHaveLength(1);
    expect(skillActivations[0].data).toMatchObject({
      name: "azure-ai",
      path: path.join("/plugins/azure-skills/skills/azure-ai", "SKILL.md"),
    });
    expect(trajectoryEvents.some(event =>
      event.type === "token_usage"
      && ((event.data.inputTokens ?? 0) > 0 || (event.data.outputTokens ?? 0) > 0)),
    ).toBe(true);
    expect(metadata.events[0]).toMatchObject({
      type: "assistant.turn_start",
      id: init.uuid,
      timestamp: "1970-01-01T00:00:00.000Z",
    });
    expect(metadata.events.at(-1)).toMatchObject({ type: "assistant.turn_end", id: result.uuid });
    expect(metadata.turnCount).toBe(1);
    expect(metadata.testComments).toEqual([]);
  });

  test("reports assistant usage and counts the prompt when early terminated before a result", async () => {
    const messages = [
      initMessage(),
      assistantMessage("message-1", [{ type: "text", text: "Ready to stop", citations: null }], usage({
        inputTokens: 3,
        outputTokens: 7,
        cacheReadTokens: 100,
        cacheWriteTokens: 200,
      })),
      resultMessage(),
    ];
    const streamClosed = vi.fn();
    mocks.query.mockReturnValue((async function* () {
      try {
        yield* messages;
      } finally {
        streamClosed();
      }
    })());

    const runner = useClaudeAgentRunner({ testName: "early-termination" });
    const metadata = await runner.run({
      model: "claude-sonnet-5",
      prompt: "Stop after the first response.",
      shouldEarlyTerminate: currentMetadata => currentMetadata.events.some(event => event.type === "assistant.message"),
      timeout: 30 * 1000,
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
    expect(metadata.rawData).toEqual(messages.slice(0, 2));
    expect(metadata.turnCount).toBe(1);
    expect(metadata.events.filter(event => event.type === "assistant.turn_end")).toHaveLength(0);
    expect(mocks.query.mock.calls[0][0].options.abortController.signal.aborted).toBe(true);
    expect(streamClosed).toHaveBeenCalledOnce();
    expect(metadata.testComments).toEqual([]);
  });

  test("uses the latest cumulative usage snapshot for each assistant message", async () => {
    const messages = [
      initMessage(),
      assistantMessage("message-1", [{ type: "thinking", thinking: "Working", signature: "signature" }], usage({
        inputTokens: 2,
        outputTokens: 3,
      })),
      assistantMessage("message-1", [{ type: "text", text: "Done", citations: null }], usage({
        inputTokens: 2,
        outputTokens: 5,
      })),
    ];
    mocks.query.mockReturnValue(toAsyncIterable(messages));

    const runner = useClaudeAgentRunner({ testName: "usage-snapshots" });
    const metadata = await runner.run({
      model: "claude-sonnet-5",
      prompt: "Complete the task.",
      timeout: 30 * 1000,
    });

    expect(metadata.tokenUsage).toMatchObject({
      inputTokens: 2,
      outputTokens: 5,
      apiCallCount: 1,
      perCallUsage: [{
        model: "claude-sonnet-5",
        inputTokens: 2,
        outputTokens: 5,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        durationMs: 0,
        initiator: "message-1",
      }],
    });
    const usageEvents = metadata.events.filter(event => event.type === "assistant.usage");
    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0].data).toMatchObject({ inputTokens: 2, outputTokens: 5 });
    expect(metadata.turnCount).toBe(1);
    expect(metadata.testComments).toEqual([]);
  });
});

function initMessage(mcpServers: SDKSystemMessage["mcp_servers"] = []): SDKSystemMessage {
  return {
    type: "system",
    subtype: "init",
    uuid: randomUUID(),
    session_id: "session-1",
    apiKeySource: "none",
    claude_code_version: "2.1.287",
    cwd: mocks.skillsDirectory,
    tools: [],
    mcp_servers: mcpServers,
    model: "claude-sonnet-5",
    permissionMode: "default",
    slash_commands: [],
    output_style: "default",
    skills: [],
    plugins: [],
  };
}

function resultMessage(): SDKResultSuccess {
  return {
    type: "result",
    subtype: "success",
    uuid: randomUUID(),
    session_id: "session-1",
    is_error: false,
    result: "Done",
    duration_ms: 10,
    duration_api_ms: 10,
    num_turns: 50,
    stop_reason: "end_turn",
    total_cost_usd: 0,
    usage: usage(),
    modelUsage: {},
    permission_denials: [],
  };
}

function assistantMessage(
  messageId: string,
  content: SDKAssistantMessage["message"]["content"],
  tokenUsage = usage(),
): SDKAssistantMessage & { timestamp: string } {
  return {
    type: "assistant",
    uuid: randomUUID(),
    session_id: "session-1",
    timestamp: "2026-01-01T00:00:01.000Z",
    parent_tool_use_id: null,
    message: {
      id: messageId,
      model: "claude-sonnet-5",
      role: "assistant",
      type: "message",
      content,
      stop_reason: null,
      stop_sequence: null,
      container: null,
      context_management: null,
      diagnostics: null,
      stop_details: null,
      usage: tokenUsage,
    },
  };
}

function assistantToolMessage(
  messageId: string,
  toolCallId: string,
  name: string,
  input: Record<string, unknown>,
): SDKAssistantMessage & { timestamp: string } {
  return assistantMessage(messageId, [{ type: "tool_use", id: toolCallId, name, input }]);
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
} = {}): SDKResultSuccess["usage"] {
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
    fallback_credit: null,
    iterations: [],
    output_tokens_details: { thinking_tokens: 0 },
    server_tool_use: { web_fetch_requests: 0, web_search_requests: 0 },
    service_tier: "standard",
    speed: "standard",
  };
}

function toolResultMessage(
  toolUseId: string,
  content: string | Array<{ type: "text"; text: string }>,
): SDKUserMessage & { timestamp: string } {
  return {
    type: "user",
    uuid: randomUUID(),
    session_id: "session-1",
    timestamp: "2026-01-01T00:00:02.000Z",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
    },
  };
}

function userTextMessage(text: string): SDKUserMessage {
  return {
    type: "user",
    uuid: randomUUID(),
    session_id: "session-1",
    parent_tool_use_id: null,
    message: { role: "user", content: [{ type: "text", text }] },
  };
}

async function* toAsyncIterable(messages: SDKMessage[]): AsyncGenerator<SDKMessage> {
  yield* messages;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}
