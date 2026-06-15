/**
 * Tests for per-run tool-usage capture (Phase 1).
 *
 * Covers computeToolUsage (ordering, success join, skill inclusion) and
 * deriveToolUsageFileName (1:1 correlation with the markdown report name).
 */

import * as path from "path";
import type { SessionEvent } from "@github/copilot-sdk";
import { computeToolUsage, deriveToolUsageFileName } from "../agent-runner.ts";

// Minimal event factories. Cast through unknown because we only populate the
// fields computeToolUsage reads; the full SessionEvent union is much larger.
function startEvent(toolName: string, toolCallId: string, args: unknown, timestamp?: string): SessionEvent {
  return {
    type: "tool.execution_start",
    timestamp,
    data: { toolName, toolCallId, arguments: args },
  } as unknown as SessionEvent;
}

function completeEvent(
  toolCallId: string,
  success: boolean,
  timestamp?: string,
  result?: unknown,
): SessionEvent {
  return {
    type: "tool.execution_complete",
    timestamp,
    data: { toolCallId, success, result },
  } as unknown as SessionEvent;
}

function otherEvent(type: string): SessionEvent {
  return { type, data: {} } as unknown as SessionEvent;
}

describe("computeToolUsage", () => {
  test("captures tools in emission order with 0-based order index", () => {
    const events: SessionEvent[] = [
      otherEvent("assistant.message"),
      startEvent("bash", "c1", { command: "ls" }),
      completeEvent("c1", true),
      startEvent("view", "c2", { path: "/tmp/a" }),
      completeEvent("c2", true),
    ];

    const result = computeToolUsage(events);

    expect(result.map((t) => [t.order, t.toolName])).toEqual([
      [0, "bash"],
      [1, "view"],
    ]);
  });

  test("includes the skill pseudo-tool in the sequence", () => {
    const events: SessionEvent[] = [
      startEvent("skill", "s1", { skill: "azure-deploy" }),
      completeEvent("s1", true),
      startEvent("bash", "c1", { command: "azd up" }),
      completeEvent("c1", true),
    ];

    const result = computeToolUsage(events);

    expect(result.map((t) => t.toolName)).toEqual(["skill", "bash"]);
    expect(result[0].arguments).toEqual({ skill: "azure-deploy" });
  });

  test("joins success by toolCallId and uses null when no completion exists", () => {
    const events: SessionEvent[] = [
      startEvent("bash", "c1", { command: "ok" }),
      completeEvent("c1", true),
      startEvent("bash", "c2", { command: "boom" }),
      completeEvent("c2", false),
      // c3 never completes (e.g. early termination / timeout).
      startEvent("view", "c3", { path: "/tmp/x" }),
    ];

    const result = computeToolUsage(events);

    expect(result).toEqual([
      { order: 0, toolName: "bash", toolCallId: "c1", arguments: { command: "ok" }, success: true, durationMs: null, outputBytes: null },
      { order: 1, toolName: "bash", toolCallId: "c2", arguments: { command: "boom" }, success: false, durationMs: null, outputBytes: null },
      { order: 2, toolName: "view", toolCallId: "c3", arguments: { path: "/tmp/x" }, success: null, durationMs: null, outputBytes: null },
    ]);
  });

  test("computes durationMs from start and completion timestamps", () => {
    const events: SessionEvent[] = [
      startEvent("bash", "c1", { command: "ok" }, "2026-06-15T11:44:05.000Z"),
      completeEvent("c1", true, "2026-06-15T11:44:06.500Z"),
      // No completion -> null duration.
      startEvent("view", "c2", { path: "/tmp/x" }, "2026-06-15T11:44:07.000Z"),
    ];

    const result = computeToolUsage(events);

    expect(result.map((t) => t.durationMs)).toEqual([1500, null]);
  });

  test("uses null duration when a completion timestamp predates its start", () => {
    const events: SessionEvent[] = [
      startEvent("bash", "c1", {}, "2026-06-15T11:44:06.000Z"),
      completeEvent("c1", true, "2026-06-15T11:44:05.000Z"),
    ];
    expect(computeToolUsage(events)[0].durationMs).toBeNull();
  });

  test("measures output bytes, preferring detailedContent over content", () => {
    const events: SessionEvent[] = [
      startEvent("bash", "c1", {}, "2026-06-15T11:44:05.000Z"),
      completeEvent("c1", true, "2026-06-15T11:44:05.100Z", {
        content: "short",
        detailedContent: "the full detailed output",
      }),
    ];
    expect(computeToolUsage(events)[0].outputBytes).toBe(
      Buffer.byteLength("the full detailed output", "utf8"),
    );
  });

  test("falls back to content, then to text/terminal blocks, excluding binary", () => {
    const fromContent: SessionEvent[] = [
      startEvent("bash", "c1", {}, "2026-06-15T11:44:05.000Z"),
      completeEvent("c1", true, "2026-06-15T11:44:05.100Z", { content: "café" }),
    ];
    // "café" is 5 UTF-8 bytes (é = 2 bytes).
    expect(computeToolUsage(fromContent)[0].outputBytes).toBe(5);

    const fromBlocks: SessionEvent[] = [
      startEvent("bash", "c2", {}, "2026-06-15T11:44:05.000Z"),
      completeEvent("c2", true, "2026-06-15T11:44:05.100Z", {
        contents: [
          { type: "text", text: "abc" },
          { type: "terminal", text: "de" },
          { type: "image", data: "BIGBASE64SHOULDNOTCOUNT" },
        ],
      }),
    ];
    expect(computeToolUsage(fromBlocks)[0].outputBytes).toBe(5);
  });

  test("uses null output bytes when there is no completion", () => {
    const events: SessionEvent[] = [
      startEvent("view", "c1", { path: "/tmp/x" }, "2026-06-15T11:44:05.000Z"),
    ];
    expect(computeToolUsage(events)[0].outputBytes).toBeNull();
  });

  test("normalizes missing arguments to null", () => {
    const events: SessionEvent[] = [startEvent("bash", "c1", undefined)];
    const result = computeToolUsage(events);
    expect(result[0].arguments).toBeNull();
  });

  test("returns an empty array when there are no tool calls", () => {
    expect(computeToolUsage([otherEvent("assistant.message")])).toEqual([]);
  });
});

describe("deriveToolUsageFileName", () => {
  test("derives a matching tool-usage name from the markdown report path", () => {
    const report = path.join("a", "b", "agent-metadata-2026-06-15T11-44-05-123Z.md");
    expect(deriveToolUsageFileName(report)).toBe(
      path.join("a", "b", "tool-usage-2026-06-15T11-44-05-123Z.json"),
    );
  });

  test("preserves the collision dedupe suffix so it stays 1:1 with the report", () => {
    const report = path.join("dir", "agent-metadata-2026-06-15T11-44-05-123Z-2.md");
    expect(deriveToolUsageFileName(report)).toBe(
      path.join("dir", "tool-usage-2026-06-15T11-44-05-123Z-2.json"),
    );
  });
});
