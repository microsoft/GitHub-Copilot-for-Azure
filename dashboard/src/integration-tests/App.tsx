import { useEffect, useState } from "react";

interface FailedTestCase {
    testName: string;
    message?: string;
    skillInvocationRate?: number;
}

interface SkillStats {
    skillInvocationTestsPassed: number;
    skillInvocationTestsFailed: number;
    averageSkillInvocationRate: number | null;
    worstSkillInvocationRate: number | null;
    otherTestsPassed: number;
    otherTestsFailed: number;
    failedTests: FailedTestCase[];
}

type SkillTestResults = Record<string, SkillStats>;

function formatRate(rate: number | null): string {
    if (rate === null) return "N/A";
    return `${(rate * 100).toFixed(1)}%`;
}

function App() {
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<SkillTestResults | null>(null);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingResults, setLoadingResults] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failurePanelSkill, setFailurePanelSkill] = useState<string | null>(null);

    // Fetch available dates on mount
    useEffect(() => {
        fetch("/api/dates")
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
        setFailurePanelSkill(null);

        fetch(`/api/test-results/${encodeURIComponent(selectedDate)}`)
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
    const panelOpen = failurePanelSkill !== null;
    const panelStats = panelOpen && testResults ? testResults[failurePanelSkill!] : null;

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
                                            <h2 className="it-skill-name">{skillName}</h2>
                                            {totalFailed > 0 && (
                                                <button
                                                    className={`it-show-failures-btn${failurePanelSkill === skillName ? " active" : ""}`}
                                                    onClick={() => setFailurePanelSkill(
                                                        failurePanelSkill === skillName ? null : skillName
                                                    )}
                                                >
                                                    {failurePanelSkill === skillName ? "Hide Failures" : `Show Failures (${totalFailed})`}
                                                </button>
                                            )}
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

                {/* Right panel - failure details (collapsible) */}
                {panelOpen && panelStats && (
                    <aside className="it-panel it-panel-failures">
                        <div className="it-panel-failures-header">
                            <h2>Failed Tests &mdash; {failurePanelSkill}</h2>
                            <button
                                className="it-close-panel-btn"
                                onClick={() => setFailurePanelSkill(null)}
                                aria-label="Close failure panel"
                            >
                                &times;
                            </button>
                        </div>
                        {panelStats.failedTests.length === 0 ? (
                            <p className="it-muted">No failed tests.</p>
                        ) : (
                            <ul className="it-failed-list">
                                {panelStats.failedTests.map((ft, idx) => (
                                    <li key={idx} className="it-failed-item">
                                        <span className="it-failed-name">{ft.testName}</span>
                                        {ft.skillInvocationRate !== undefined && (
                                            <span className="it-failed-rate">
                                                rate: {formatRate(ft.skillInvocationRate)}
                                            </span>
                                        )}
                                        {ft.message && (
                                            <span className="it-failed-message">{ft.message}</span>
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

export default App;
