import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FileViewer from "./FileViewer";

interface BlobEntry {
    name: string;
    blobName: string;
}

interface BlobTreeNode {
    files: BlobEntry[];
    children: Record<string, BlobTreeNode>;
}

type BlobTree = Record<string, BlobTreeNode>;

/**
 * Recursively collect all .md files from a blob tree node.
 */
function collectMdFiles(node: BlobTreeNode): BlobEntry[] {
    const results: BlobEntry[] = [];
    for (const file of node.files) {
        if (file.name.endsWith(".md")) {
            results.push(file);
        }
    }
    for (const child of Object.values(node.children)) {
        results.push(...collectMdFiles(child));
    }
    return results;
}

function reportLabel(filename: string): string {
    return filename
        .replace(/^msbench_analysis_report_/, "")
        .replace(/_\d{4}-\d{2}-\d{2}\.md$/, "")
        || filename;
}

function App() {
    const urlParams = new URLSearchParams(window.location.search);
    const fileToView = urlParams.get("file");

    if (fileToView) {
        return <FileViewer blobPath={fileToView} />;
    }

    return <Dashboard />;
}

function Dashboard() {
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [reports, setReports] = useState<BlobEntry[]>([]);
    const [selectedReport, setSelectedReport] = useState<BlobEntry | null>(null);
    const [reportMarkdown, setReportMarkdown] = useState<string>("");
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch available dates on mount
    useEffect(() => {
        fetch("/api/msbench-dates")
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: string[]) => {
                setDates(data);
                if (data.length > 0) {
                    const params = new URLSearchParams(window.location.search);
                    const requested = params.get("date");
                    setSelectedDate(requested && data.includes(requested) ? requested : data[0]);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingDates(false));
    }, []);

    // Fetch reports when a date is selected
    useEffect(() => {
        if (!selectedDate) return;

        setError(null);
        setLoadingData(true);
        setReports([]);
        setSelectedReport(null);
        setReportMarkdown("");

        fetch(`/api/msbench-data/${encodeURIComponent(selectedDate)}`)
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: BlobTree) => {
                const dateNode = data[selectedDate];
                if (dateNode) {
                    const allReports = collectMdFiles(dateNode).sort((a, b) => a.name.localeCompare(b.name));
                    setReports(allReports);
                    if (allReports.length > 0) {
                        setSelectedReport(allReports[0]);
                    }
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingData(false));
    }, [selectedDate]);

    // Load report content when a report is selected
    useEffect(() => {
        if (!selectedReport) {
            setReportMarkdown("");
            return;
        }

        setLoadingReport(true);
        fetch(`/api/msbench-download?path=${encodeURIComponent(selectedReport.blobName)}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load report: ${res.status}`);
                return res.text();
            })
            .then((md) => setReportMarkdown(md))
            .catch((err) => setReportMarkdown(`*Error loading report: ${err.message}*`))
            .finally(() => setLoadingReport(false));
    }, [selectedReport]);

    if (loadingDates) {
        return <div className="nr-app"><p className="nr-loading">Loading&hellip;</p></div>;
    }

    if (error) {
        return <div className="nr-app"><p className="nr-error">Error: {error}</p></div>;
    }

    return (
        <div className="nr-dashboard" id="main">
            <header className="nr-header">
                <h1>MSBench Nightly Runs{selectedDate ? ` \u2014 ${selectedDate}` : ""}</h1>
            </header>

            <div className="msb-body">
                {/* Panel 1 - Dates */}
                <aside className="nr-panel nr-panel-dates">
                    <h2>Dates</h2>
                    <ul className="nr-date-list">
                        {dates.map((d) => (
                            <li key={d}>
                                <button
                                    className={`nr-date-link${d === selectedDate ? " active" : ""}`}
                                    onClick={() => setSelectedDate(d)}
                                >
                                    {d}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Panel 2 - Benchmarks */}
                <aside className="nr-panel msb-panel-reports-list">
                    <h2>Benchmarks</h2>
                    {loadingData ? (
                        <p className="nr-muted">Loading&hellip;</p>
                    ) : reports.length === 0 ? (
                        <p className="nr-muted">No reports for this date.</p>
                    ) : (
                        <ul className="nr-date-list">
                            {reports.map((r) => (
                                <li key={r.blobName}>
                                    <button
                                        className={`nr-date-link${selectedReport?.blobName === r.blobName ? " active" : ""}`}
                                        onClick={() => setSelectedReport(r)}
                                    >
                                        {reportLabel(r.name)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                {/* Panel 3 - Report content */}
                <main className="nr-panel nr-panel-reports">
                    <h2>
                        {selectedReport
                            ? `Report \u2014 ${reportLabel(selectedReport.name)}`
                            : "Report"}
                    </h2>
                    {loadingReport ? (
                        <p>Loading report&hellip;</p>
                    ) : reportMarkdown ? (
                        <div className="nr-markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {reportMarkdown}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <p className="nr-muted">Select a report to view its content.</p>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
