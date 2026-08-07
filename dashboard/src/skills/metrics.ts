// Pure helpers for shaping test-run-metrics rows into per-test daily series.
// Kept separate from the React component so the logic is easy to reason about.

export interface MetricsRow {
    skill: string;
    testName: string;
    branch: string;
    runId: string;
    runDate: string;
    runTimestamp: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs?: number;
    turns?: number;
}

/** A single point in a per-metric daily series. `value` is null on days with no run. */
export interface DayPoint {
    date: string;
    value: number | null;
}

/** The three metrics graphed per test. */
export type MetricKey = "durationMs" | "totalTokens" | "turns";

/**
 * Return the last `n` calendar days (inclusive of `today`) as YYYY-MM-DD
 * strings, oldest first. `today` defaults to now (UTC date).
 */
export function lastNDates(n: number, today: Date = new Date()): string[] {
    const dates: string[] = [];
    const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    for (let i = n - 1; i >= 0; i--) {
        dates.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
    }
    return dates;
}

/** The calendar day (YYYY-MM-DD) a row belongs to, preferring runDate. */
function rowDate(row: MetricsRow): string {
    return row.runDate || (row.runTimestamp ? row.runTimestamp.slice(0, 10) : "");
}

/** Read a metric off a row as a number, or null when absent (e.g. legacy rows). */
function metricValue(row: MetricsRow, metric: MetricKey): number | null {
    const raw = row[metric];
    if (raw === undefined || raw === null || (raw as unknown) === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * Build a daily series for one metric across `dates`. When a day has multiple
 * runs, their values are averaged. Days with no data (or only legacy rows
 * missing the metric) are left as `null` so the chart renders a gap.
 */
export function buildDaySeries(
    rows: MetricsRow[],
    metric: MetricKey,
    dates: string[],
): DayPoint[] {
    const sums = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
        const value = metricValue(row, metric);
        if (value === null) continue;
        const day = rowDate(row);
        if (!day) continue;
        const acc = sums.get(day) ?? { sum: 0, count: 0 };
        acc.sum += value;
        acc.count += 1;
        sums.set(day, acc);
    }
    return dates.map((date) => {
        const acc = sums.get(date);
        return { date, value: acc ? acc.sum / acc.count : null };
    });
}

/** Group rows by test name, sorted alphabetically. */
export function groupByTest(rows: MetricsRow[]): Map<string, MetricsRow[]> {
    const byTest = new Map<string, MetricsRow[]>();
    for (const row of rows) {
        const list = byTest.get(row.testName);
        if (list) list.push(row);
        else byTest.set(row.testName, [row]);
    }
    return new Map([...byTest.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
