import type { SessionEvent } from "@github/copilot-sdk";
import { describe, expect, test } from "vitest";
import type { AgentMetadata } from "../../utils/agent-runner.ts";
import { convertToTrajectoryEvents } from "../../utils/agent-runner.ts";

type ToolStart = Extract<SessionEvent, { type: "tool.execution_start" }>;

function metadata(data: ToolStart["data"], success = true): AgentMetadata {
  const timestamp = "2026-10-30T00:00:00Z";
  return {
    events: [
      { type: "tool.execution_start", id: "start", parentId: null, timestamp, data },
      {
        type: "tool.execution_complete", id: "end", parentId: "start", timestamp,
        data: { toolCallId: data.toolCallId, success, result: { content: "response" } },
      },
    ],
    testComments: [], turnCount: 1, toolCounts: {}, skillFiles: {}, skillsLoaded: [],
  };
}

describe("convertToTrajectoryEvents", () => {
  test("preserves main's user-turn tracking when normalizing namespace commands", () => {
    const source = metadata({
      toolName: "Azure.advisor", mcpToolName: "advisor", toolCallId: "call",
      arguments: { command: "advisor_recommendation_list", parameters: { subscriptions: ["demo"] } },
    });
    const userMessage = (id: string): SessionEvent => ({
      type: "user.message", id, parentId: null, timestamp: "2026-10-30T00:00:00Z",
      data: { content: id },
    });
    source.events.unshift(userMessage("first"));
    source.events.push(userMessage("second"));
    const before = structuredClone(source);
    const events = convertToTrajectoryEvents(source);
    expect(events.map(event => event.turn)).toEqual([0, 0, 0, 1]);
    expect(events[1]).toMatchObject({
      type: "tool_call", data: { toolName: "advisor_recommendation_list" },
    });
    expect(source).toEqual(before);
  });

  test.each([true, false])("normalizes namespace calls and results without changing raw events (success=%s)", success => {
    const parameters = { subscriptions: ["demo"], prioritized: true, top: 20 };
    const source = metadata({
      toolName: "Azure.advisor", mcpToolName: "advisor", mcpServerName: "Azure",
      parentToolCallId: "parent", toolCallId: "call",
      arguments: { command: "advisor_recommendation_list", parameters },
    }, success);
    const before = structuredClone(source);
    const events = convertToTrajectoryEvents(source);
    expect(events[0]).toMatchObject({
      type: "tool_call",
      data: {
        toolName: "advisor_recommendation_list", toolCallId: "call", arguments: parameters,
        mcpToolName: "advisor", mcpServerName: "Azure", parentToolCallId: "parent",
      },
    });
    expect(events[1]).toMatchObject({
      type: "tool_result",
      data: { toolName: "advisor_recommendation_list", toolCallId: "call", success, result: { content: "response" } },
    });
    expect(source).toEqual(before);
  });

  test.each<{ args: ToolStart["data"]["arguments"] }>([
    { args: { command: "advisor_recommendation_update", learn: true } },
    { args: { intent: "Discover Advisor commands" } },
    { args: { command: "storage_account_get" } },
    { args: { command: 42 } },
    { args: null },
    { args: [] },
  ])("preserves discovery and non-command arguments: %j", ({ args }) => {
    const events = convertToTrajectoryEvents(metadata({
      toolName: "Azure.advisor", mcpToolName: "advisor", toolCallId: "call", arguments: args,
    }));
    expect(events[0]?.data).toEqual({
      toolName: "Azure.advisor", mcpToolName: "advisor", toolCallId: "call", arguments: args,
    });
    expect(events[1]).toMatchObject({ type: "tool_result", data: { toolName: "Azure.advisor" } });
  });

  test("preserves direct commands and unrelated tools", () => {
    const calls: ToolStart["data"][] = [
      { toolName: "advisor_recommendation_list", mcpToolName: "advisor_recommendation_list",
        toolCallId: "direct", arguments: { category: "Cost" } },
      { toolName: "shell", toolCallId: "shell", arguments: { command: "advisor_recommendation_list" } },
    ];
    for (const data of calls) {
      const events = convertToTrajectoryEvents(metadata(data));
      expect(events[0]?.data).toEqual(data);
      expect(events[1]).toMatchObject({ type: "tool_result", data: { toolName: data.toolName } });
    }
  });
});
