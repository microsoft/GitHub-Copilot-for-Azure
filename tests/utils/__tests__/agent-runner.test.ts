import type { SessionEvent } from "@github/copilot-sdk";
import { describe, expect, test } from "vitest";
import { convertToTrajectoryEvents, type AgentMetadata } from "../agent-runner.ts";

describe("convertToTrajectoryEvents skill activations", () => {
  function skillToolEvent(skill: string): SessionEvent {
    return {
      id: "tool-start",
      timestamp: "2026-01-01T00:00:01.000Z",
      parentId: null,
      type: "tool.execution_start",
      data: {
        toolName: "skill",
        toolCallId: "skill-call",
        arguments: { skill },
      },
    } as SessionEvent;
  }

  function nativeSkillEvent(skill: string, id: string, seconds: string): SessionEvent {
    return {
      id,
      timestamp: `2026-01-01T00:00:${seconds}.000Z`,
      parentId: null,
      type: "skill.invoked",
      data: {
        name: skill,
        path: `/skills/${skill}/SKILL.md`,
        content: "",
      },
    } as SessionEvent;
  }

  function metadata(events: SessionEvent[]): AgentMetadata {
    return {
      events,
      testComments: [],
      turnCount: 0,
      toolCounts: {},
      skillFiles: {},
      skillsLoaded: [],
    };
  }

  test("converts tool-only skill calls into activations and retains tool calls", () => {
    const converted = convertToTrajectoryEvents(metadata([
      skillToolEvent("azure-ai"),
    ]));

    expect(converted.map(event => event.type)).toEqual([
      "skill_activation",
      "tool_call",
    ]);
    expect(converted.filter(event => event.type === "skill_activation")).toHaveLength(1);
    expect(converted.filter(event => event.type === "tool_call")).toHaveLength(1);
  });

  test("converts native skill.invoked events into activations", () => {
    const converted = convertToTrajectoryEvents(metadata([
      nativeSkillEvent("azure-ai", "native-first", "01"),
    ]));

    expect(converted.map(event => event.type)).toEqual([
      "skill_activation",
    ]);
    expect(converted.map(event => event.data)).toEqual([
      { name: "azure-ai", path: "/skills/azure-ai/SKILL.md" },
    ]);
  });

  test("uses the native activation instead of duplicating its matching tool event", () => {
    const converted = convertToTrajectoryEvents(metadata([
      skillToolEvent("azure-ai"),
      nativeSkillEvent("azure-ai", "native-first", "02"),
    ]));

    expect(converted.map(event => event.type)).toEqual([
      "tool_call",
      "skill_activation",
    ]);
    expect(converted.filter(event => event.type === "skill_activation")).toHaveLength(1);
    expect(converted.filter(event => event.type === "tool_call")).toHaveLength(1);
    expect(converted
      .filter(event => event.type === "skill_activation")
      .map(event => event.data.path)).toEqual([
        "/skills/azure-ai/SKILL.md",
      ]);
  });
});
