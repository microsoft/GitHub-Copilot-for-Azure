import { useEffect, useMemo, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { apiUrl } from "../shared/apiUrl";
import {
    buildDaySeries,
    groupByTest,
    lastNDates,
    type DayPoint,
    type MetricKey,
    type MetricsRow,
} from "./metrics";

/** Number of trailing days shown in every graph. */
const WINDOW_DAYS = 10;

/** Repository whose issues are surfaced from each skill page. */
const ISSUES_REPO = "microsoft/GitHub-Copilot-for-Azure";

/**
 * Build a GitHub search URL for the open issues labelled with a skill's name.
 * The skill name is used verbatim as the label value.
 */
export function issuesUrl(skillName: string): string {
    const query = `is:issue state:open label:"${skillName}"`;
    return `https://github.com/${ISSUES_REPO}/issues?q=${encodeURIComponent(query)}`;
}

/** A plugin skill with its description, as surfaced by the frontmatter collector. */
interface Skill {
    name: string;
    description: string;
    descriptionLength: number;
}

/** Minimal shape of the health data returned by /api/static. */
interface HealthCategoryItem {
    name: string;
    metadata?: Record<string, string | number | boolean>;
}
interface HealthData {
    categories?: Record<string, { items?: HealthCategoryItem[] }>;
}

function isPluginSkillPath(pathValue: string): boolean {
    const normalized = pathValue.replace(/\\/g, "/");
    return normalized.startsWith("output/skills/") || normalized.startsWith("plugin/skills/");
}

/** Extract plugin skills (with descriptions) from the frontmatter category. */
function skillsFromHealthData(data: HealthData): Skill[] {
    const items = data.categories?.frontmatter?.items ?? [];
    const skills: Skill[] = [];
    for (const item of items) {
        const path = String(item.metadata?.path ?? "");
        // Only plugin skills; the frontmatter check also covers .github/skills.
        if (!isPluginSkillPath(path)) continue;
        const description = String(item.metadata?.description ?? "");
        skills.push({ name: item.name, description, descriptionLength: description.length });
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
}

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
    { key: "durationMs", label: "Total duration", format: (v) => `${(v / 1000).toFixed(1)}s` },
    { key: "totalTokens", label: "Token usage", format: (v) => formatCompact(v) },
    { key: "turns", label: "Turns", format: (v) => String(Math.round(v)) },
];

/** Compact number label (e.g. 1.2k, 3.4M). */
function formatCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(Math.round(value));
}

/** Short axis label for a YYYY-MM-DD date (month/day). */
function shortDate(date: string): string {
    return date.slice(5);
}

function Sparkline({
    data,
    format,
}: {
    data: DayPoint[];
    format: (v: number) => string;
}) {
    const hasData = data.some((p) => p.value !== null);
    if (!hasData) {
        return <div className="skills-spark-empty">No data</div>;
    }
    return (
        <ResponsiveContainer width="100%" height={80}>
            <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 4 }}>
                <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={16}
                />
                <YAxis
                    domain={["auto", "auto"]}
                    tickFormatter={format}
                    tick={{ fontSize: 10 }}
                    width={40}
                />
                <Tooltip
                    formatter={(value) => {
                        // Missing-data days carry null; show a placeholder
                        // rather than a misleading "0".
                        if (value === null || value === undefined) {
                            return ["No data", ""] as [string, string];
                        }
                        return [format(Number(value)), ""] as [string, string];
                    }}
                    labelFormatter={(l) => String(l)}
                    contentStyle={{ fontSize: 12 }}
                />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-focus, #3b82f6)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={true}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

function TestGraphs({ testName, rows }: { testName: string; rows: MetricsRow[] }) {
    const dates = useMemo(() => lastNDates(WINDOW_DAYS), []);
    return (
        <section className="skills-test">
            <h3 className="skills-test-name">{testName}</h3>
            <div className="skills-graph-row">
                {METRICS.map((m) => (
                    <div className="skills-graph" key={m.key}>
                        <span className="skills-graph-label">{m.label}</span>
                        <Sparkline data={buildDaySeries(rows, m.key, dates)} format={m.format} />
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function App() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [rows, setRows] = useState<MetricsRow[]>([]);
    const [skillsError, setSkillsError] = useState<string | null>(null);
    const [rowsError, setRowsError] = useState<string | null>(null);
    const [skillsLoading, setSkillsLoading] = useState(true);
    const [rowsLoading, setRowsLoading] = useState(false);

    // Load the list of plugin skills and honour a ?skill= deep link.
    useEffect(() => {
        fetch(apiUrl("/api/static"))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json() as Promise<HealthData>;
            })
            .then((data) => {
                const list = skillsFromHealthData(data);
                setSkills(list);
                const deepLink = new URLSearchParams(window.location.search).get("skill");
                if (deepLink && list.some((s) => s.name === deepLink)) {
                    setSelected(deepLink);
                } else if (list.length > 0) {
                    setSelected(list[0].name);
                }
            })
            .catch((err) => setSkillsError(err.message))
            .finally(() => setSkillsLoading(false));
    }, []);

    // Load per-test metrics for the selected skill (main branch only).
    useEffect(() => {
        if (!selected) return;
        // Abort a previous in-flight request so a slow response for an
        // earlier skill can't overwrite the current selection's data.
        const controller = new AbortController();
        setRowsLoading(true);
        setRowsError(null);
        setRows([]);
        const params = new URLSearchParams({ skill: selected, branch: "main" });
        fetch(apiUrl(`/api/test-run-metrics?${params}`), { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json() as Promise<MetricsRow[]>;
            })
            .then((data) => setRows(data))
            .catch((err) => {
                if (err.name !== "AbortError") setRowsError(err.message);
            })
            .finally(() => {
                // Don't flip loading off if this effect was superseded.
                if (!controller.signal.aborted) setRowsLoading(false);
            });
        return () => controller.abort();
    }, [selected]);

    const selectedSkill = useMemo(
        () => skills.find((s) => s.name === selected),
        [skills, selected],
    );
    const byTest = useMemo(() => groupByTest(rows), [rows]);

    const handleSelect = (name: string) => {
        setSelected(name);
        const url = new URL(window.location.href);
        url.searchParams.set("skill", name);
        window.history.replaceState(null, "", url);
    };

    return (
        <div className="skills-layout" id="main">
            <aside className="skills-sidebar" aria-label="Skills">
                <h2 className="skills-sidebar-title">Skills</h2>
                {skillsLoading && <p className="skills-muted">Loading…</p>}
                {skillsError && <p className="skills-error">{skillsError}</p>}
                <ul className="skills-list">
                    {skills.map((s) => (
                        <li key={s.name}>
                            <button
                                type="button"
                                className={
                                    "skills-list-item" + (s.name === selected ? " active" : "")
                                }
                                aria-current={s.name === selected ? "true" : undefined}
                                onClick={() => handleSelect(s.name)}
                            >
                                {s.name}
                            </button>
                        </li>
                    ))}
                </ul>
                {!skillsLoading && !skillsError && skills.length === 0 && (
                    <p className="skills-muted">No skills found.</p>
                )}
            </aside>

            <main className="skills-detail">
                {!selectedSkill && !skillsLoading && (
                    <p className="skills-muted">Select a skill to see details.</p>
                )}
                {selectedSkill && (
                    <>
                        <header className="skills-detail-header">
                            <h1>{selectedSkill.name}</h1>
                            <p className="skills-description">
                                {selectedSkill.description || <em>No description.</em>}
                            </p>
                            <p className="skills-desc-length">
                                Description length: {selectedSkill.descriptionLength} characters
                            </p>
                            <p className="skills-issues-link">
                                <a
                                    href={issuesUrl(selectedSkill.name)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View open issues for {selectedSkill.name} ↗
                                </a>
                            </p>
                        </header>

                        <h2 className="skills-tests-heading">
                            Tests — last {WINDOW_DAYS} days (main)
                        </h2>
                        {rowsLoading && <p className="skills-muted">Loading metrics…</p>}
                        {rowsError && <p className="skills-error">{rowsError}</p>}
                        {!rowsLoading && !rowsError && byTest.size === 0 && (
                            <p className="skills-muted">No test runs found for this skill.</p>
                        )}
                        {[...byTest.entries()].map(([testName, testRows]) => (
                            <TestGraphs key={testName} testName={testName} rows={testRows} />
                        ))}
                    </>
                )}
            </main>
        </div>
    );
}
