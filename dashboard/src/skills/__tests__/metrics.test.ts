import { describe, it, expect } from "vitest";
import {
    buildDaySeries,
    groupByTest,
    lastNDates,
    type MetricsRow,
} from "../metrics";

/** Build a MetricsRow with only the fields the helpers read. */
function row(overrides: Partial<MetricsRow>): MetricsRow {
    return {
        skill: "s",
        testName: "t",
        branch: "main",
        runId: "r",
        runDate: "",
        runTimestamp: "",
        model: "m",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        ...overrides,
    };
}

describe("lastNDates", () => {
    const today = new Date("2026-01-10T05:00:00Z");

    it("returns an empty array for n=0", () => {
        expect(lastNDates(0, today)).toEqual([]);
    });

    it("returns just today for n=1", () => {
        expect(lastNDates(1, today)).toEqual(["2026-01-10"]);
    });

    it("returns oldest-first, inclusive of today", () => {
        expect(lastNDates(3, today)).toEqual([
            "2026-01-08",
            "2026-01-09",
            "2026-01-10",
        ]);
    });

    it("uses the UTC calendar day regardless of intra-day time", () => {
        // Late-UTC and early-UTC on the same date must produce the same day.
        const lateUtc = new Date("2026-01-10T23:59:59Z");
        const earlyUtc = new Date("2026-01-10T00:00:01Z");
        expect(lastNDates(2, lateUtc)).toEqual(lastNDates(2, earlyUtc));
        expect(lastNDates(2, lateUtc)).toEqual(["2026-01-09", "2026-01-10"]);
    });

    it("crosses month boundaries correctly", () => {
        expect(lastNDates(2, new Date("2026-03-01T12:00:00Z"))).toEqual([
            "2026-02-28",
            "2026-03-01",
        ]);
    });
});

describe("buildDaySeries", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];

    it("returns all-null points for empty rows", () => {
        expect(buildDaySeries([], "totalTokens", dates)).toEqual([
            { date: "2026-01-01", value: null },
            { date: "2026-01-02", value: null },
            { date: "2026-01-03", value: null },
        ]);
    });

    it("yields null (not zero) when the metric field is absent", () => {
        const rows = [row({ runDate: "2026-01-02", turns: undefined })];
        const series = buildDaySeries(rows, "turns", dates);
        expect(series[1]).toEqual({ date: "2026-01-02", value: null });
    });

    it("distinguishes a real zero from a missing metric", () => {
        const rows = [row({ runDate: "2026-01-02", turns: 0 })];
        const series = buildDaySeries(rows, "turns", dates);
        expect(series[1]).toEqual({ date: "2026-01-02", value: 0 });
    });

    it("averages multiple runs on the same day", () => {
        const rows = [
            row({ runDate: "2026-01-02", totalTokens: 100 }),
            row({ runDate: "2026-01-02", totalTokens: 300 }),
        ];
        const series = buildDaySeries(rows, "totalTokens", dates);
        expect(series[1].value).toBe(200);
    });

    it("ignores rows whose date falls outside the window", () => {
        const rows = [
            row({ runDate: "2025-12-31", totalTokens: 999 }),
            row({ runDate: "2026-01-03", totalTokens: 42 }),
        ];
        const series = buildDaySeries(rows, "totalTokens", dates);
        expect(series[0].value).toBeNull();
        expect(series[2].value).toBe(42);
    });

    it("falls back to the timestamp date when runDate is empty", () => {
        const rows = [
            row({ runDate: "", runTimestamp: "2026-01-03T08:00:00Z", turns: 5 }),
        ];
        const series = buildDaySeries(rows, "turns", dates);
        expect(series[2].value).toBe(5);
    });
});

describe("groupByTest", () => {
    it("returns an empty map for empty input", () => {
        expect(groupByTest([]).size).toBe(0);
    });

    it("groups rows by test name", () => {
        const rows = [
            row({ testName: "a", runId: "1" }),
            row({ testName: "a", runId: "2" }),
            row({ testName: "b", runId: "3" }),
        ];
        const grouped = groupByTest(rows);
        expect(grouped.get("a")).toHaveLength(2);
        expect(grouped.get("b")).toHaveLength(1);
    });

    it("orders test names alphabetically", () => {
        const rows = [
            row({ testName: "charlie" }),
            row({ testName: "alpha" }),
            row({ testName: "bravo" }),
        ];
        expect([...groupByTest(rows).keys()]).toEqual([
            "alpha",
            "bravo",
            "charlie",
        ]);
    });
});
