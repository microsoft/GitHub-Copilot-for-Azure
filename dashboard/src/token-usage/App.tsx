import { useEffect, useMemo, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { apiUrl } from "../shared/apiUrl";

interface TokenUsageRow {
    skill: string;
    testName: string;
    branch: string;
    runId: string;
    runDate: string;
    runTimestamp: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
}

interface TokenUsageFilters {
    skills: string[];
    tests: string[];
    branches: string[];
    testsBySkill: Record<string, string[]>;
}

interface RunPoint {
    run: string;
    timestamp: string;
    total: number;
    rollingAvg: number;
}

/** Window size for the trailing rolling average series. */
const ROLLING_WINDOW = 5;

/** Format a token count into a compact, readable label (e.g. 1.2k, 3.4M). */
function formatCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(value);
}

/** Short, stable label for a run on the time axis. */
function runLabel(runDate: string, runId: string): string {
    const shortId = runId && runId !== "unknown" ? runId.slice(-6) : "";
    return shortId ? `${runDate} (${shortId})` : runDate;
}

export default function App() {
    const [filters, setFilters] = useState<TokenUsageFilters>({ skills: [], tests: [], branches: [], testsBySkill: {} });
    const [selectedSkill, setSelectedSkill] = useState<string>("");
    const [selectedTest, setSelectedTest] = useState<string>("");
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [timeRange, setTimeRange] = useState<string>("30");
    const [customStart, setCustomStart] = useState<string>("");
    const [customEnd, setCustomEnd] = useState<string>("");
    const [rows, setRows] = useState<TokenUsageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersReady, setFiltersReady] = useState(false);

    const loadFilters = () =>
        fetch(apiUrl("/api/token-usage/filters"))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: TokenUsageFilters) => {
                setFilters({ ...data, testsBySkill: data.testsBySkill ?? {} });
                if (data.branches?.includes("main")) setSelectedBranch("main");
            })
            .catch((err) => setError(err.message))
            .finally(() => setFiltersReady(true));

    const loadRows = () => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedSkill) params.set("skill", selectedSkill);
        if (selectedTest) params.set("test", selectedTest);
        if (selectedBranch) params.set("branch", selectedBranch);

        return fetch(apiUrl(`/api/token-usage?${params}`))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: TokenUsageRow[]) => setRows(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadFilters();
    }, []);

    useEffect(() => {
        if (!filtersReady) return;
        loadRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersReady, selectedSkill, selectedTest, selectedBranch]);

    // Tests available for the current skill selection. With no skill chosen,
    // show all tests; otherwise restrict to that skill's associated tests.
    const availableTests = useMemo<string[]>(() => {
        if (!selectedSkill) return filters.tests;
        return filters.testsBySkill[selectedSkill] ?? [];
    }, [selectedSkill, filters]);

    // When the skill changes, drop a selected test that no longer applies.
    const handleSkillChange = (skill: string) => {
        setSelectedSkill(skill);
        const nextTests = skill ? filters.testsBySkill[skill] ?? [] : filters.tests;
        if (selectedTest && !nextTests.includes(selectedTest)) setSelectedTest("");
    };

    // Filter rows by the selected time range (based on runDate).
    const filteredRows = useMemo(() => {
        if (timeRange === "all") return rows;
        let startDate: string;
        let endDate: string;
        if (timeRange === "custom") {
            if (!customStart && !customEnd) return rows;
            startDate = customStart;
            endDate = customEnd;
        } else {
            const days = parseInt(timeRange, 10);
            const now = new Date();
            now.setDate(now.getDate() - days);
            startDate = now.toISOString().slice(0, 10);
            endDate = "";
        }
        return rows.filter((row) => {
            const date = row.runDate || (row.runTimestamp ? row.runTimestamp.slice(0, 10) : "");
            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;
            return true;
        });
    }, [rows, timeRange, customStart, customEnd]);

    // Aggregate total tokens per run (across the currently filtered rows),
    // ordered over time, then compute a trailing rolling average.
    const chartData = useMemo<RunPoint[]>(() => {
        const byRun = new Map<string, { total: number; timestamp: string; runDate: string; runId: string }>();
        for (const row of filteredRows) {
            const runId = row.runId || "unknown";
            const runDate = row.runDate || (row.runTimestamp ? row.runTimestamp.slice(0, 10) : "");
            const ts = row.runTimestamp || `${runDate}T00:00:00.000Z`;
            const existing = byRun.get(runId);
            const total = Number(row.totalTokens) || 0;
            if (existing) {
                existing.total += total;
                if (ts < existing.timestamp) existing.timestamp = ts;
            } else {
                byRun.set(runId, { total, timestamp: ts, runDate, runId });
            }
        }

        const ordered = [...byRun.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return ordered.map((run, i) => {
            const windowStart = Math.max(0, i - (ROLLING_WINDOW - 1));
            const window = ordered.slice(windowStart, i + 1);
            const rollingAvg = window.reduce((sum, r) => sum + r.total, 0) / window.length;
            return {
                run: runLabel(run.runDate, run.runId),
                timestamp: run.timestamp,
                total: run.total,
                rollingAvg: Math.round(rollingAvg),
            };
        });
    }, [filteredRows]);

    return (
        <div className="pd-dashboard" id="main">
            <header className="pd-header">
                <h1>Integration Test Token Usage Over Time</h1>
            </header>

            <div className="pd-filters">
                <label className="pd-filter">
                    <span>Skill</span>
                    <select value={selectedSkill} onChange={(e) => handleSkillChange(e.target.value)}>
                        <option value="">All Skills</option>
                        {filters.skills.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="pd-filter">
                    <span>Test</span>
                    <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)}>
                        <option value="">All Tests</option>
                        {availableTests.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="pd-filter">
                    <span>Branch</span>
                    <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                        <option value="">All Branches</option>
                        {filters.branches.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="pd-filter">
                    <span>Time Range</span>
                    <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="7">Past 7 days</option>
                        <option value="14">Past 14 days</option>
                        <option value="30">Past 30 days</option>
                        <option value="all">All time</option>
                        <option value="custom">Custom range</option>
                    </select>
                </label>

                {timeRange === "custom" && (
                    <div className="pd-custom-range">
                        <label className="pd-filter">
                            <span>Start</span>
                            <input
                                type="date"
                                className="pd-date-input"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                            />
                        </label>
                        <label className="pd-filter">
                            <span>End</span>
                            <input
                                type="date"
                                className="pd-date-input"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                            />
                        </label>
                    </div>
                )}
            </div>

            {error && <p className="pd-error">Error: {error}</p>}

            {loading ? (
                <p className="pd-loading">Loading token usage…</p>
            ) : chartData.length === 0 ? (
                <p className="pd-empty">No token usage data available for the selected filters.</p>
            ) : (
                <div className="pd-charts">
                    <section className="pd-chart-section">
                        <h2>Total Tokens per Run</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 48, left: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="run"
                                    angle={-30}
                                    textAnchor="end"
                                    height={70}
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    width={80}
                                    tickFormatter={(v: number) => formatCompact(v)}
                                />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        value.toLocaleString(),
                                        name,
                                    ]}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="total"
                                    name="Total Tokens"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ r: 2 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="rollingAvg"
                                    name={`Rolling Avg (last ${ROLLING_WINDOW} runs)`}
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </section>
                </div>
            )}
        </div>
    );
}
