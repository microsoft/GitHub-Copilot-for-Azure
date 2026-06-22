import { useEffect, useState } from "react";
import type { BlobTree, BlobTreeNode } from "../shared/blobTree";
import { apiUrl, pageUrl } from "../shared/apiUrl";

interface TestCase {
    testName: string;
    message?: string;
    skillInvocationRate?: number;
    expectsScreenshot?: boolean;
}

// Cache /api/data/{date} responses keyed by encoded date so repeated lookups
// (e.g. clicking the agentMetadata button on multiple test cases for the
// same date) reuse a single network request.
const blobTreeCache = new Map<string, Promise<BlobTree>>();

function fetchBlobTree(date: string): Promise<BlobTree> {
    const key = encodeURIComponent(date);
    let cached = blobTreeCache.get(key);
    if (!cached) {
        cached = fetch(apiUrl(`/api/data/${key}`))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json() as Promise<BlobTree>;
            })
            .catch((err) => {
                blobTreeCache.delete(key);
                throw err;
            });
        blobTreeCache.set(key, cached);
    }
    return cached;
}

function findTestCaseBlobs(
    dateNode: BlobTreeNode,
    testName: string,
    pattern: RegExp,
): string[] {
    const targetFolder = `/${formatTestName(testName)}/`;
    const matches: string[] = [];
    const walk = (node: BlobTreeNode): void => {
        for (const file of node.files) {
            if (file.blobName.includes(targetFolder) && pattern.test(file.blobName)) {
                matches.push(file.blobName);
            }
        }
        for (const child of Object.values(node.children)) {
            walk(child);
        }
    };
    walk(dateNode);
    return matches;
}

async function openAgentMetadataLinks(date: string, testName: string): Promise<void> {
    const tree = await fetchBlobTree(date);
    const dateNode = tree[date];
    if (!dateNode) throw new Error("No data for this date.");

    const matches = findTestCaseBlobs(dateNode, testName, /\/agent-metadata-[^/]+\.md$/);

    if (matches.length === 0) {
        throw new Error("No agentMetadata files found for this test case.");
    }
    for (const blobName of matches) {
        // Note: when there are multiple matches, the browser may block attempts
        // to open the new page after the first one.
        // The user may unblock pop ups from this website or open them individually.
        window.open(
            pageUrl(`/nightly-runs.html?file=${encodeURIComponent(blobName)}`),
            "_blank",
            "noopener,noreferrer",
        );
    }
}

async function findAppSnapshotBlob(date: string, testName: string): Promise<string | null> {
    const tree = await fetchBlobTree(date);
    const dateNode = tree[date];
    if (!dateNode) return null;
    const found = findTestCaseBlobs(dateNode, testName, /\/app-snapshot\.jpe?g$/i);
    return found[0] ?? null;
}

// --- Tool usage (Phase 2b) -------------------------------------------------

/** One tool call as returned by GET /api/tool-usage (one row per call). */
interface ToolCallRow {
    runToken: string;
    runId: string;
    runDate: string;
    runTimestamp: string;
    order: number;
    toolName: string;
    /** "true" | "false" | "unknown". */
    successState: string;
    /** Present only when a completion was observed. */
    durationMs?: number;
    outputBytes?: number;
}

/** Tool calls for a single run, ordered by call order. */
interface ToolRun {
    runToken: string;
    runId: string;
    runTimestamp: string;
    calls: ToolCallRow[];
}

// Cache /api/tool-usage responses keyed by skill+test+date so re-expanding a
// test's Tools section reuses a single network request.
const toolUsageCache = new Map<string, Promise<ToolCallRow[]>>();

function fetchToolUsage(skill: string, test: string, runDate: string): Promise<ToolCallRow[]> {
    const key = `${skill}\u0000${test}\u0000${runDate}`;
    let cached = toolUsageCache.get(key);
    if (!cached) {
        const params = new URLSearchParams({ skill, test, runDate });
        cached = fetch(apiUrl(`/api/tool-usage?${params.toString()}`))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json() as Promise<ToolCallRow[]>;
            })
            .catch((err) => {
                toolUsageCache.delete(key);
                throw err;
            });
        toolUsageCache.set(key, cached);
    }
    return cached;
}

/** Group flat tool-call rows into runs (by runToken), each sorted by order. */
function groupToolRuns(rows: ToolCallRow[]): ToolRun[] {
    const byToken = new Map<string, ToolRun>();
    for (const r of rows) {
        let run = byToken.get(r.runToken);
        if (!run) {
            run = { runToken: r.runToken, runId: r.runId, runTimestamp: r.runTimestamp, calls: [] };
            byToken.set(r.runToken, run);
        }
        run.calls.push(r);
    }
    const runs = [...byToken.values()];
    for (const run of runs) {
        run.calls.sort((a, b) => a.order - b.order);
    }
    runs.sort(
        (a, b) =>
            (a.runTimestamp || "").localeCompare(b.runTimestamp || "") ||
            a.runToken.localeCompare(b.runToken),
    );
    return runs;
}

/** Locate this run's tool-usage-<runToken>.json blob within the date's tree. */
async function findToolUsageBlob(date: string, runToken: string): Promise<string | null> {
    const tree = await fetchBlobTree(date);
    const dateNode = tree[date];
    if (!dateNode) return null;
    const target = `tool-usage-${runToken}.json`;
    let result: string | null = null;
    const walk = (node: BlobTreeNode): void => {
        if (result) return;
        for (const file of node.files) {
            if (file.name === target) {
                result = file.blobName;
                return;
            }
        }
        for (const child of Object.values(node.children)) {
            if (result) return;
            walk(child);
        }
    };
    walk(dateNode);
    return result;
}

/** Fetch a single tool call's full arguments on demand from the per-run blob. */
async function fetchToolCallArguments(date: string, runToken: string, order: number): Promise<unknown> {
    const blobName = await findToolUsageBlob(date, runToken);
    if (!blobName) throw new Error("Tool-usage blob not found for this run.");
    const res = await fetch(apiUrl(`/api/fetch?path=${encodeURIComponent(blobName)}`));
    if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
    const data = (await res.json()) as { toolCalls?: Array<{ order: number; arguments?: unknown }> };
    const call = data.toolCalls?.find((c) => c.order === order);
    if (!call) throw new Error("Tool call not found in run blob.");
    return call.arguments ?? null;
}

/** Human-readable duration; em dash when unknown (no completion observed). */
function formatDuration(durationMs?: number): string {
    if (typeof durationMs !== "number") return "\u2014";
    if (durationMs < 1000) return `${durationMs} ms`;
    return `${(durationMs / 1000).toFixed(2)} s`;
}

/** Human-readable byte size; em dash when unknown. */
function formatBytes(bytes?: number): string {
    if (typeof bytes !== "number") return "\u2014";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AZURE_DEPLOY_SKILL = "azure-deploy";

interface SkillStats {
    skillInvocationTestsPassed: number;
    skillInvocationTestsFailed: number;
    averageSkillInvocationRate: number | null;
    worstSkillInvocationRate: number | null;
    otherTestsPassed: number;
    otherTestsFailed: number;
    failedTests: TestCase[];
    passedTests: TestCase[];
}

type SkillTestResults = Record<string, SkillStats>;

function formatRate(rate: number | null): string {
    if (rate === null) return "N/A";
    return `${(rate * 100).toFixed(1)}%`;
}

function formatTestName(name: string): string {
    return name.replace(/\s+/g, "_");
}

function App() {
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<SkillTestResults | null>(null);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingResults, setLoadingResults] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailsPanelSkill, setDetailsPanelSkill] = useState<string | null>(null);

    // Fetch available dates on mount
    useEffect(() => {
        fetch(apiUrl("/api/dates"))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: string[]) => {
                setDates(data);
                if (data.length > 0) {
                    setSelectedDate(data[0]);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingDates(false));
    }, []);

    // Fetch test results when a date is selected
    useEffect(() => {
        if (!selectedDate) return;

        setError(null);
        setLoadingResults(true);
        setTestResults(null);
        setDetailsPanelSkill(null);

        fetch(apiUrl(`/api/test-results/${encodeURIComponent(selectedDate)}`))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: SkillTestResults) => setTestResults(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoadingResults(false));
    }, [selectedDate]);

    if (loadingDates) {
        return <div className="it-app"><p className="it-loading">Loading&hellip;</p></div>;
    }

    if (error && !testResults) {
        return <div className="it-app"><p className="it-error">Error: {error}</p></div>;
    }

    const skillNames = testResults ? Object.keys(testResults).sort() : [];
    const panelOpen = detailsPanelSkill !== null;
    const panelStats = panelOpen && testResults ? testResults[detailsPanelSkill!] : null;

    return (
        <div className="it-dashboard" id="main">
            <header className="it-header">
                <h1>Integration Tests{selectedDate ? ` \u2014 ${selectedDate}` : ""}</h1>
            </header>

            <div className={`it-body${panelOpen ? " it-body-with-panel" : ""}`}>
                {/* Left panel - date list */}
                <aside className="it-panel it-panel-dates">
                    <h2>Dates</h2>
                    <ul className="it-date-list">
                        {dates.map((d) => (
                            <li key={d}>
                                <button
                                    className={`it-date-link${d === selectedDate ? " active" : ""}`}
                                    onClick={() => setSelectedDate(d)}
                                >
                                    {d}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Main content - test results */}
                <main className="it-panel it-panel-content">
                    {loadingResults ? (
                        <p className="it-loading">Loading test results&hellip;</p>
                    ) : error ? (
                        <p className="it-error">Error: {error}</p>
                    ) : skillNames.length === 0 ? (
                        <p className="it-muted">No test results for this date.</p>
                    ) : (
                        <div className="it-results">
                            {skillNames.map((skillName) => {
                                const stats = testResults![skillName];
                                const totalFailed = stats.skillInvocationTestsFailed + stats.otherTestsFailed;
                                return (
                                    <section key={skillName} className="it-skill-section">
                                        <div className="it-skill-header">
                                            <h2 className="it-skill-name">
                                                {stats.worstSkillInvocationRate !== null && stats.worstSkillInvocationRate < 0.8 && (
                                                    <span className="it-warn-icon" title="Worst skill invocation rate is below 80%">&#9888;</span>
                                                )}
                                                {skillName}
                                            </h2>
                                            <button
                                                className={`it-show-details-btn${totalFailed === 0 ? " it-show-details-btn-pass" : ""}${detailsPanelSkill === skillName ? " active" : ""}`}
                                                onClick={() => setDetailsPanelSkill(
                                                    detailsPanelSkill === skillName ? null : skillName
                                                )}
                                            >
                                                {detailsPanelSkill === skillName ? "Hide Details" : `Show Details${totalFailed > 0 ? ` (${totalFailed} failed)` : ""}`}
                                            </button>
                                        </div>
                                        <div className="it-stats-grid">
                                            <div className="it-stat-group">
                                                <h3>Skill Invocation Tests</h3>
                                                <div className="it-stat-row">
                                                    <span className="it-stat it-stat-pass">{stats.skillInvocationTestsPassed} passed</span>
                                                    <span className="it-stat it-stat-fail">{stats.skillInvocationTestsFailed} failed</span>
                                                </div>
                                                <div className="it-stat-row">
                                                    <span className={`it-stat it-stat-rate${stats.averageSkillInvocationRate !== null && stats.averageSkillInvocationRate < 0.8 ? " it-stat-warn" : ""}`}>
                                                        Avg rate: {formatRate(stats.averageSkillInvocationRate)}
                                                    </span>
                                                    <span className={`it-stat it-stat-rate${stats.worstSkillInvocationRate !== null && stats.worstSkillInvocationRate < 0.8 ? " it-stat-warn" : ""}`}>
                                                        Worst rate: {formatRate(stats.worstSkillInvocationRate)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="it-stat-group">
                                                <h3>Other Tests</h3>
                                                <div className="it-stat-row">
                                                    <span className="it-stat it-stat-pass">{stats.otherTestsPassed} passed</span>
                                                    <span className="it-stat it-stat-fail">{stats.otherTestsFailed} failed</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </main>

                {/* Right panel - test details (collapsible) */}
                {panelOpen && panelStats && (
                    <aside className="it-panel it-panel-details">
                        <div className="it-panel-details-header">
                            <h2>Test Details &mdash; {detailsPanelSkill}</h2>
                            <button
                                className="it-close-panel-btn"
                                onClick={() => setDetailsPanelSkill(null)}
                                aria-label="Close panel"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Failed Tests Section */}
                        <h3 className="it-panel-section-title it-panel-section-fail">Failed Tests ({panelStats.failedTests.length})</h3>
                        {panelStats.failedTests.length === 0 ? (
                            <p className="it-muted">No failed tests.</p>
                        ) : (
                            <ul className="it-failed-list">
                                {panelStats.failedTests.map((ft, idx) => (
                                    <li key={idx} className="it-failed-item">
                                        <a
                                            className="it-failed-name"
                                            href={pageUrl(`/nightly-runs.html?date=${encodeURIComponent(selectedDate!)}#${encodeURIComponent(formatTestName(ft.testName))}`)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {formatTestName(ft.testName)}
                                        </a>
                                        {ft.skillInvocationRate !== undefined && (
                                            <span className="it-failed-rate">
                                                rate: {formatRate(ft.skillInvocationRate)}
                                            </span>
                                        )}
                                        {ft.message && (
                                            <span className="it-failed-message">{ft.message}</span>
                                        )}
                                        <ViewAgentMetadataButton
                                            date={selectedDate!}
                                            testName={ft.testName}
                                        />
                                        <ToolUsageSection
                                            date={selectedDate!}
                                            skill={detailsPanelSkill!}
                                            testName={ft.testName}
                                        />
                                        {/* Show the preview for legacy items which don't the flag set */}
                                        {detailsPanelSkill === AZURE_DEPLOY_SKILL && ft.expectsScreenshot !== false && (
                                            <AppSnapshotPreview
                                                date={selectedDate!}
                                                testName={ft.testName}
                                            />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Passed Tests Section */}
                        <h3 className="it-panel-section-title it-panel-section-pass">Passed Tests ({panelStats.passedTests.length})</h3>
                        {panelStats.passedTests.length === 0 ? (
                            <p className="it-muted">No passed tests.</p>
                        ) : (
                            <ul className="it-passed-list">
                                {panelStats.passedTests.map((pt, idx) => (
                                    <li key={idx} className="it-passed-item">
                                        <a
                                            className="it-passed-name"
                                            href={pageUrl(`/nightly-runs.html?date=${encodeURIComponent(selectedDate!)}#${encodeURIComponent(formatTestName(pt.testName))}`)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {formatTestName(pt.testName)}
                                        </a>
                                        {pt.skillInvocationRate !== undefined && (
                                            <span className="it-passed-rate">
                                                rate: {formatRate(pt.skillInvocationRate)}
                                            </span>
                                        )}
                                        <ViewAgentMetadataButton
                                            date={selectedDate!}
                                            testName={pt.testName}
                                        />
                                        <ToolUsageSection
                                            date={selectedDate!}
                                            skill={detailsPanelSkill!}
                                            testName={pt.testName}
                                        />
                                        {/* Show the preview for legacy items which don't the flag set */}
                                        {detailsPanelSkill === AZURE_DEPLOY_SKILL && pt.expectsScreenshot !== false && (
                                            <AppSnapshotPreview
                                                date={selectedDate!}
                                                testName={pt.testName}
                                            />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>
                )}
            </div>
        </div>
    );
}

function ViewAgentMetadataButton({ date, testName }: { date: string; testName: string }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const onClick = async () => {
        setBusy(true);
        setErr(null);
        try {
            await openAgentMetadataLinks(date, testName);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <span className="it-view-agent-metadata">
            <button
                className="it-view-agent-metadata-btn"
                onClick={onClick}
                disabled={busy}
            >
                {busy ? "Loading\u2026" : "view agentMetadata"}
            </button>
            {err && <span className="it-view-agent-metadata-error">{err}</span>}
        </span>
    );
}

function AppSnapshotPreview({ date, testName }: { date: string; testName: string }) {
    const [blobName, setBlobName] = useState<string | null | undefined>(undefined);
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setBlobName(undefined);
        setImgFailed(false);
        findAppSnapshotBlob(date, testName)
            .then((found) => {
                if (!cancelled) setBlobName(found);
            })
            .catch(() => {
                if (!cancelled) setBlobName(null);
            });
        return () => {
            cancelled = true;
        };
    }, [date, testName]);

    if (blobName === undefined) {
        return <div className="it-app-snapshot it-app-snapshot-empty">Loading snapshot&hellip;</div>;
    }

    if (blobName === null || imgFailed) {
        return (
            <div className="it-app-snapshot it-app-snapshot-empty">
                Snapshot not available
            </div>
        );
    }

    const url = apiUrl(`/api/fetch?path=${encodeURIComponent(blobName)}`);
    const viewerUrl = pageUrl(`/image-viewer.html?path=${encodeURIComponent(blobName)}`);
    return (
        <div className="it-app-snapshot">
            <a
                className="it-app-snapshot-link"
                href={viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open snapshot in new tab"
            >
                <img
                    className="it-app-snapshot-img"
                    src={url}
                    alt={`App snapshot for ${formatTestName(testName)}`}
                    loading="lazy"
                    onError={() => setImgFailed(true)}
                />
            </a>
        </div>
    );
}

function ToolUsageSection({ date, skill, testName }: { date: string; skill: string; testName: string }) {
    const [open, setOpen] = useState(false);
    const [runs, setRuns] = useState<ToolRun[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next && runs === null && !loading) {
            setLoading(true);
            setErr(null);
            try {
                const rows = await fetchToolUsage(skill, formatTestName(testName), date);
                setRuns(groupToolRuns(rows));
            } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="it-tools">
            <button className="it-tools-toggle" onClick={toggle} aria-expanded={open}>
                {open ? "\u25be" : "\u25b8"} Tools
            </button>
            {open && (
                <div className="it-tools-body">
                    {loading ? (
                        <p className="it-muted">Loading tools&hellip;</p>
                    ) : err ? (
                        <p className="it-error">{err}</p>
                    ) : !runs || runs.length === 0 ? (
                        <p className="it-muted">No tool data for this run.</p>
                    ) : (
                        runs.map((run, i) => (
                            <div key={run.runToken} className="it-tool-run">
                                <div className="it-tool-run-header">
                                    <span className="it-tool-run-title">
                                        {runs.length > 1 ? `Run ${i + 1}` : "Run"} &middot; {run.calls.length} call{run.calls.length === 1 ? "" : "s"}
                                    </span>
                                    <span className="it-tool-run-meta">{run.runTimestamp}</span>
                                </div>
                                <ol className="it-tool-call-list">
                                    {run.calls.map((call) => (
                                        <ToolCallItem
                                            key={call.order}
                                            date={date}
                                            runToken={run.runToken}
                                            call={call}
                                        />
                                    ))}
                                </ol>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function ToolCallItem({ date, runToken, call }: { date: string; runToken: string; call: ToolCallRow }) {
    const [open, setOpen] = useState(false);
    const [args, setArgs] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const toggleArgs = async () => {
        const next = !open;
        setOpen(next);
        if (next && args === undefined && !loading) {
            setLoading(true);
            setErr(null);
            try {
                const a = await fetchToolCallArguments(date, runToken, call.order);
                setArgs(JSON.stringify(a, null, 2));
            } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        }
    };

    const icon = call.successState === "true" ? "\u2713" : call.successState === "false" ? "\u2717" : "?";
    const iconClass =
        call.successState === "true"
            ? "it-tool-ok"
            : call.successState === "false"
              ? "it-tool-fail"
              : "it-tool-unknown";

    return (
        <li className="it-tool-call">
            <div className="it-tool-call-row">
                <span className="it-tool-order">{call.order}</span>
                <span className={`it-tool-status ${iconClass}`} title={`success: ${call.successState}`}>
                    {icon}
                </span>
                <span className="it-tool-name">{call.toolName}</span>
                <span className="it-tool-metric" title="duration">{formatDuration(call.durationMs)}</span>
                <span className="it-tool-metric" title="output size">{formatBytes(call.outputBytes)}</span>
                <button className="it-tool-args-btn" onClick={toggleArgs} aria-expanded={open}>
                    {open ? "hide args" : "args"}
                </button>
            </div>
            {open &&
                (loading ? (
                    <p className="it-muted">Loading args&hellip;</p>
                ) : err ? (
                    <p className="it-error">{err}</p>
                ) : (
                    <pre className="it-tool-args">{args}</pre>
                ))}
        </li>
    );
}

export default App;
