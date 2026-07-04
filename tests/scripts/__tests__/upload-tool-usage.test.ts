/**
 * Tests for the tool-usage uploader pure helpers (Phase 2a).
 *
 * Focuses on the deterministic transforms — run-token derivation, success
 * mapping, per-call row expansion, and row-key distinctness — that turn a
 * captured tool-usage-<token>.json file into Azure Table rows.
 */

import {
  deriveRunToken,
  successStateOf,
  buildToolRowKey,
  expandToolUsageToRows,
  groupRowsForTransactions,
  type ToolUsageFile,
  type ToolUsageRow,
  type UploadContext,
} from "../upload-tool-usage.ts";

const ctx: UploadContext = { skill: "azure-quotas", branch: "main", runId: "123" };

describe("deriveRunToken", () => {
  test("strips the tool-usage- prefix and .json suffix", () => {
    expect(deriveRunToken("tool-usage-2026-06-15T11-44-05-123Z.json")).toBe(
      "2026-06-15T11-44-05-123Z",
    );
  });

  test("works on a full path and preserves a collision dedupe suffix", () => {
    expect(deriveRunToken("/a/b/tool-usage-2026-06-15T11-44-05-123Z-2.json")).toBe(
      "2026-06-15T11-44-05-123Z-2",
    );
  });
});

describe("successStateOf", () => {
  test("maps true/false/null/undefined to stable states", () => {
    expect(successStateOf(true)).toBe("true");
    expect(successStateOf(false)).toBe("false");
    expect(successStateOf(null)).toBe("unknown");
    expect(successStateOf(undefined)).toBe("unknown");
  });
});

describe("buildToolRowKey", () => {
  test("is stable for the same inputs", () => {
    const a = buildToolRowKey("main", "123", "t", "tok", 0);
    const b = buildToolRowKey("main", "123", "t", "tok", 0);
    expect(a).toBe(b);
  });

  test("differs by order within the same run", () => {
    const a = buildToolRowKey("main", "123", "t", "tok", 0);
    const b = buildToolRowKey("main", "123", "t", "tok", 1);
    expect(a).not.toBe(b);
  });

  test("differs across runs of the same test (distinct run tokens)", () => {
    const a = buildToolRowKey("main", "123", "t", "tokA", 0);
    const b = buildToolRowKey("main", "123", "t", "tokB", 0);
    expect(a).not.toBe(b);
  });
});

describe("expandToolUsageToRows", () => {
  const file: ToolUsageFile = {
    testName: "azure-quotas_Quota_check",
    reportFile: "agent-metadata-2026-06-15T11-44-05-123Z.md",
    sessionId: "sess-1",
    model: "claude-sonnet-4.6",
    timestamp: "2026-06-15T11:44:05.123Z",
    toolCalls: [
      { order: 0, toolName: "skill", toolCallId: "s1", success: true, durationMs: 12, outputBytes: 40 },
      { order: 1, toolName: "bash", toolCallId: "c1", success: false, durationMs: 3400, outputBytes: 0 },
      { order: 2, toolName: "view", toolCallId: "c2", success: null, durationMs: null, outputBytes: null },
    ],
  };

  test("emits one row per tool call with run context and derived runDate", () => {
    const rows = expandToolUsageToRows(file, "2026-06-15T11-44-05-123Z", ctx);

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => [r.order, r.toolName, r.successState])).toEqual([
      [0, "skill", "true"],
      [1, "bash", "false"],
      [2, "view", "unknown"],
    ]);

    const [first] = rows;
    expect(first.partitionKey).toBe("azure-quotas");
    expect(first.skill).toBe("azure-quotas");
    expect(first.branch).toBe("main");
    expect(first.runId).toBe("123");
    expect(first.runToken).toBe("2026-06-15T11-44-05-123Z");
    expect(first.runDate).toBe("2026-06-15");
    expect(first.runTimestamp).toBe("2026-06-15T11:44:05.123Z");
    expect(first.reportFile).toBe("agent-metadata-2026-06-15T11-44-05-123Z.md");
    expect(first.sessionId).toBe("sess-1");
    expect(first.model).toBe("claude-sonnet-4.6");
  });

  test("gives every row in a run a distinct rowKey", () => {
    const rows = expandToolUsageToRows(file, "tok", ctx);
    const keys = new Set(rows.map((r) => r.rowKey));
    expect(keys.size).toBe(rows.length);
  });

  test("includes durationMs only when known, omitting it otherwise", () => {
    const rows = expandToolUsageToRows(file, "tok", ctx);
    expect(rows[0].durationMs).toBe(12);
    expect(rows[1].durationMs).toBe(3400);
    expect("durationMs" in rows[2]).toBe(false);
  });

  test("includes outputBytes when known (including 0), omitting it otherwise", () => {
    const rows = expandToolUsageToRows(file, "tok", ctx);
    expect(rows[0].outputBytes).toBe(40);
    expect(rows[1].outputBytes).toBe(0);
    expect("outputBytes" in rows[2]).toBe(false);
  });

  test("returns no rows when there are no tool calls", () => {
    const empty: ToolUsageFile = { testName: "t", toolCalls: [] };
    expect(expandToolUsageToRows(empty, "tok", ctx)).toEqual([]);
  });

  test("falls back to safe defaults for missing optional fields", () => {
    const sparse: ToolUsageFile = {
      testName: "t",
      toolCalls: [{ order: 0, toolName: "bash", toolCallId: "c1" }],
    };
    const [row] = expandToolUsageToRows(sparse, "tok", ctx);
    expect(row.reportFile).toBe("");
    expect(row.sessionId).toBe("");
    expect(row.model).toBe("unknown");
    expect(row.successState).toBe("unknown");
  });
});

describe("groupRowsForTransactions", () => {
  function rowWith(partitionKey: string, rowKey: string): ToolUsageRow {
    return {
      partitionKey,
      rowKey,
      skill: partitionKey,
      testName: "t",
      branch: "main",
      runId: "123",
      runDate: "2026-06-15",
      runTimestamp: "2026-06-15T11:44:05.123Z",
      runToken: "tok",
      reportFile: "",
      sessionId: "",
      model: "unknown",
      order: 0,
      toolName: "bash",
      toolCallId: "c",
      successState: "unknown",
    };
  }

  test("returns no batches for no rows", () => {
    expect(groupRowsForTransactions([])).toEqual([]);
  });

  test("keeps a single small same-partition run in one batch", () => {
    const rows = [rowWith("s", "a"), rowWith("s", "b"), rowWith("s", "c")];
    const batches = groupRowsForTransactions(rows);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
  });

  test("chunks a large same-partition run to at most maxBatchSize", () => {
    const rows = Array.from({ length: 250 }, (_, i) => rowWith("s", `r${i}`));
    const batches = groupRowsForTransactions(rows, 100);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    // No batch mixes partition keys.
    for (const batch of batches) {
      expect(new Set(batch.map((r) => r.partitionKey)).size).toBe(1);
    }
  });

  test("never mixes partition keys within a batch", () => {
    const rows = [rowWith("a", "1"), rowWith("b", "1"), rowWith("a", "2")];
    const batches = groupRowsForTransactions(rows);
    for (const batch of batches) {
      expect(new Set(batch.map((r) => r.partitionKey)).size).toBe(1);
    }
    // All rows are preserved across batches.
    expect(batches.reduce((n, b) => n + b.length, 0)).toBe(3);
  });
});
