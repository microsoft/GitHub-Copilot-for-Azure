import { useEffect, useState, useMemo, useCallback } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface EvalMetricRow {
    date: string;
    benchmark: string;
    model: string;
    totalConsumedTokens: number;
    totalSteps: number;
    resolved: number;
}

interface EvalFilters {
    benchmarks: string[];
    models: string[];
}

/** Generate a visually distinct color for index i out of total. */
function seriesColor(i: number, total: number): string {
    const hue = (i * 360) / Math.max(total, 1);
    return `hsl(${Math.round(hue)}, 70%, 50%)`;
}

function displayName(name: string): string {
    return name
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

/** Shorten "benchmark — model" for display. */
function shortLabel(key: string): string {
    const parts = key.split(" — ");
    if (parts.length === 2) {
        return `${displayName(parts[0])}  ·  ${parts[1]}`;
    }
    return displayName(key);
}

export default function App() {
    const [filters, setFilters] = useState<EvalFilters>({ benchmarks: [], models: [] });
    const [selectedBenchmark, setSelectedBenchmark] = useState<string>("");
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [selectedResolved, setSelectedResolved] = useState<string>("");
    const [timeRange, setTimeRange] = useState<string>("30");
    const [customStart, setCustomStart] = useState<string>("");
    const [customEnd, setCustomEnd] = useState<string>("");
    const [metrics, setMetrics] = useState<EvalMetricRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<"" | "new" | "all">("");
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const toggleSeries = useCallback((name: string) => {
        setHiddenSeries((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    const showAll = useCallback(() => setHiddenSeries(new Set()), []);
    const hideAll = useCallback(
        () => setHiddenSeries(new Set(seriesNames)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [metrics, selectedBenchmark, selectedModel],
    );

    const loadFilters = () =>
        fetch("/api/msbench-eval-metrics/filters")
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: EvalFilters) => setFilters(data))
            .catch((err) => setError(err.message));

    const loadMetrics = () => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedBenchmark) params.set("benchmark", selectedBenchmark);
        if (selectedModel) params.set("model", selectedModel);
        if (selectedResolved) params.set("resolved", selectedResolved);

        return fetch(`/api/msbench-eval-metrics?${params}`)
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: EvalMetricRow[]) => setMetrics(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    const handleSync = async (force: boolean) => {
        setSyncing(force ? "all" : "new");
        setSyncResult(null);
        try {
            const url = force
                ? "/api/msbench-eval-metrics/sync?force=true"
                : "/api/msbench-eval-metrics/sync";
            const res = await fetch(url, { method: "POST" });
            if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
            const data = await res.json();
            setSyncResult(`Synced ${data.synced} entries.`);
            // Reload data after sync
            await loadFilters();
            await loadMetrics();
        } catch (err: any) {
            setSyncResult(`Sync error: ${err.message}`);
        } finally {
            setSyncing("");
        }
    };

    // Load filter options
    useEffect(() => {
        loadFilters();
    }, []);

    // Load metrics whenever filters change
    useEffect(() => {
        loadMetrics();
    }, [selectedBenchmark, selectedModel, selectedResolved]);

    // Filter metrics by time range
    const filteredMetrics = useMemo(() => {
        if (timeRange === "all") return metrics;
        let startDate: string;
        let endDate: string;
        if (timeRange === "custom") {
            if (!customStart && !customEnd) return metrics;
            startDate = customStart;
            endDate = customEnd;
        } else {
            const days = parseInt(timeRange, 10);
            const now = new Date();
            now.setDate(now.getDate() - days);
            startDate = now.toISOString().slice(0, 10);
            endDate = "";
        }
        return metrics.filter((row) => {
            if (startDate && row.date < startDate) return false;
            if (endDate && row.date > endDate) return false;
            return true;
        });
    }, [metrics, timeRange, customStart, customEnd]);

    // Build a series key for each metric row based on active filters
    const seriesKey = (row: EvalMetricRow): string => {
        if (selectedBenchmark && selectedModel) return row.model;
        if (selectedBenchmark) return row.model;
        if (selectedModel) return row.benchmark;
        return `${row.benchmark} — ${row.model}`;
    };

    // Discover unique series names for multi-line rendering
    const seriesNames = useMemo(() => {
        const set = new Set<string>();
        for (const row of filteredMetrics) set.add(seriesKey(row));
        return [...set].sort();
    }, [filteredMetrics, selectedBenchmark, selectedModel]);

    // Build chart data: one row per date, with per-series columns
    const tokenChartData = useMemo(() => {
        const byDate: Record<string, Record<string, number>> = {};
        for (const row of filteredMetrics) {
            if (!byDate[row.date]) byDate[row.date] = {};
            const key = seriesKey(row);
            byDate[row.date][key] = (byDate[row.date][key] || 0) + (Number(row.totalConsumedTokens) || 0);
        }
        return Object.entries(byDate)
            .map(([date, series]) => ({ date, ...series }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredMetrics, selectedBenchmark, selectedModel]);

    const stepsChartData = useMemo(() => {
        const byDate: Record<string, Record<string, number>> = {};
        for (const row of filteredMetrics) {
            if (!byDate[row.date]) byDate[row.date] = {};
            const key = seriesKey(row);
            byDate[row.date][key] = (byDate[row.date][key] || 0) + (Number(row.totalSteps) || 0);
        }
        return Object.entries(byDate)
            .map(([date, series]) => ({ date, ...series }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredMetrics]);

    const resolvedChartData = useMemo(() => {
        const byDate: Record<string, Record<string, number>> = {};
        for (const row of filteredMetrics) {
            if (!byDate[row.date]) byDate[row.date] = {};
            const key = seriesKey(row);
            byDate[row.date][key] = Number(row.resolved) || 0;
        }
        return Object.entries(byDate)
            .map(([date, series]) => ({ date, ...series }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredMetrics, selectedBenchmark, selectedModel]);

    return (
        <div className="pd-dashboard" id="main">
            <header className="pd-header">
                <h1>Performance Dashboard</h1>
            </header>

            {/* Filters */}
            <div className="pd-filters">
                <label className="pd-filter">
                    <span>Benchmark</span>
                    <select
                        value={selectedBenchmark}
                        onChange={(e) => setSelectedBenchmark(e.target.value)}
                    >
                        <option value="">All Benchmarks</option>
                        {filters.benchmarks.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="pd-filter">
                    <span>Model</span>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        <option value="">All Models</option>
                        {filters.models.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="pd-filter">
                    <span>Resolved</span>
                    <select
                        value={selectedResolved}
                        onChange={(e) => setSelectedResolved(e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="1">Resolved (1)</option>
                        <option value="0">Unresolved (0)</option>
                    </select>
                </label>

                <label className="pd-filter">
                    <span>Time Range</span>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                    >
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

                <div className="pd-sync">
                    <button
                        className="pd-sync-button"
                        onClick={() => handleSync(false)}
                        disabled={!!syncing}
                    >
                        {syncing === "new" ? "Syncing…" : "Sync New Data"}
                    </button>
                    <button
                        className="pd-sync-button"
                        onClick={() => handleSync(true)}
                        disabled={!!syncing}
                    >
                        {syncing === "all" ? "Syncing…" : "Sync All Data"}
                    </button>
                    {syncResult && <span className="pd-sync-result">{syncResult}</span>}
                </div>
            </div>

            {/* Charts */}
            {error && <p className="pd-error">Error: {error}</p>}

            {loading ? (
                <p className="pd-loading">Loading metrics…</p>
            ) : tokenChartData.length === 0 ? (
                <p className="pd-empty">No metrics data available for the selected filters.</p>
            ) : (
                <div className="pd-charts">
                    {/* Shared legend */}
                    <div className="pd-legend">
                        <div className="pd-legend-controls">
                            <span className="pd-legend-title">
                                Series ({seriesNames.length - hiddenSeries.size}/{seriesNames.length})
                            </span>
                            <button className="pd-legend-btn" onClick={showAll}>Show all</button>
                            <button className="pd-legend-btn" onClick={hideAll}>Hide all</button>
                        </div>
                        <div className="pd-legend-items">
                            {seriesNames.map((name, i) => (
                                <button
                                    key={name}
                                    className={`pd-legend-item${
                                        hiddenSeries.has(name) ? " pd-legend-item--hidden" : ""
                                    }`}
                                    onClick={() => toggleSeries(name)}
                                    title={name}
                                >
                                    <span
                                        className="pd-legend-swatch"
                                        style={{ background: seriesColor(i, seriesNames.length) }}
                                    />
                                    {shortLabel(name)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <section className="pd-chart-section">
                        <h2>Total Consumed Tokens (×1000)</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={tokenChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(v: number) => (v / 1000).toLocaleString()}
                                />
                                <Tooltip
                                    formatter={(value, name) => [
                                        Number(value).toLocaleString(),
                                        shortLabel(String(name)),
                                    ]}
                                />
                                {seriesNames.map((name, i) => (
                                    <Line
                                        key={name}
                                        type="linear"
                                        dataKey={name}
                                        name={name}
                                        stroke={seriesColor(i, seriesNames.length)}
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                        connectNulls
                                        hide={hiddenSeries.has(name)}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </section>

                    <section className="pd-chart-section">
                        <h2>Total Steps</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={stepsChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value, name) => [
                                        Number(value).toLocaleString(),
                                        shortLabel(String(name)),
                                    ]}
                                />
                                {seriesNames.map((name, i) => (
                                    <Line
                                        key={name}
                                        type="linear"
                                        dataKey={name}
                                        name={name}
                                        stroke={seriesColor(i, seriesNames.length)}
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                        connectNulls
                                        hide={hiddenSeries.has(name)}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </section>

                    <section className="pd-chart-section">
                        <h2>Resolved (1 = true, 0 = false)</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={resolvedChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} domain={[0, 1]} ticks={[0, 1]} />
                                <Tooltip
                                    formatter={(value, name) => [
                                        Number(value),
                                        shortLabel(String(name)),
                                    ]}
                                />
                                {seriesNames.map((name, i) => (
                                    <Line
                                        key={name}
                                        type="linear"
                                        dataKey={name}
                                        name={name}
                                        stroke={seriesColor(i, seriesNames.length)}
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                        connectNulls
                                        hide={hiddenSeries.has(name)}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </section>
                </div>
            )}
        </div>
    );
}
