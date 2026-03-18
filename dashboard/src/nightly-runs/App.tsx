import { useEffect, useState, useCallback } from "react";
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

interface FileSection {
    label: string;
    files: BlobEntry[];
}

/**
 * Organizes files into sections based on their path hierarchy.
 * Sections are labeled with run ID / skill name / group or test case name.
 */
function organizeFilesIntoSections(dateNode: BlobTreeNode): FileSection[] {
    const sections: FileSection[] = [];

    for (const [runId, runNode] of Object.entries(dateNode.children)) {
        for (const [skillName, skillNode] of Object.entries(runNode.children)) {
            if (skillNode.files.length > 0) {
                sections.push({
                    label: `${runId} / ${skillName}`,
                    files: [...skillNode.files],
                });
            }

            for (const [groupOrCase, groupNode] of Object.entries(skillNode.children)) {
                if (groupNode.files.length > 0) {
                    sections.push({
                        label: `${runId} / ${skillName} / ${groupOrCase}`,
                        files: [...groupNode.files],
                    });
                }

                for (const [testCase, testNode] of Object.entries(groupNode.children)) {
                    if (testNode.files.length > 0) {
                        sections.push({
                            label: `${runId} / ${skillName} / ${groupOrCase} / ${testCase}`,
                            files: [...testNode.files],
                        });
                    }
                }
            }
        }
    }

    return sections;
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
    const [tree, setTree] = useState<BlobTree | null>(null);
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [reportMarkdown, setReportMarkdown] = useState<string>("");
    const [fileSections, setFileSections] = useState<FileSection[]>([]);
    const [loadingTree, setLoadingTree] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/data")
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: BlobTree) => {
                setTree(data);
                const sortedDates = Object.keys(data).sort().reverse();
                setDates(sortedDates);
                if (sortedDates.length > 0) {
                    setSelectedDate(sortedDates[0]);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingTree(false));
    }, []);

    useEffect(() => {
        if (!selectedDate || !tree) return;

        const dateNode = tree[selectedDate];
        if (dateNode) {
            setFileSections(organizeFilesIntoSections(dateNode));
        } else {
            setFileSections([]);
        }

        setLoadingReport(true);
        setReportMarkdown("");
        fetch(`/api/reports/${encodeURIComponent(selectedDate)}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load reports: ${res.status}`);
                return res.text();
            })
            .then((md) => setReportMarkdown(md))
            .catch((err) => setReportMarkdown(`*Error loading reports: ${err.message}*`))
            .finally(() => setLoadingReport(false));
    }, [selectedDate, tree]);

    const handleDownload = useCallback((blobName: string) => {
        const viewerUrl = `${window.location.origin}${window.location.pathname}?file=${encodeURIComponent(blobName)}`;
        window.open(viewerUrl, "_blank");
    }, []);

    if (loadingTree) {
        return <div className="nr-app"><p className="nr-loading">Loading&hellip;</p></div>;
    }

    if (error) {
        return <div className="nr-app"><p className="nr-error">Error: {error}</p></div>;
    }

    return (
        <div className="nr-dashboard" id="main">
            <header className="nr-header">
                <h1>Nightly Runs{selectedDate ? ` \u2014 ${selectedDate}` : ""}</h1>
            </header>

            <div className="nr-body">
                {/* Left panel - date list */}
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

                {/* Center panel - skill reports */}
                <main className="nr-panel nr-panel-reports">
                    <h2>Skill Reports &mdash; {selectedDate ?? "none"}</h2>
                    {loadingReport ? (
                        <p>Loading reports&hellip;</p>
                    ) : (
                        <div className="nr-markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {reportMarkdown}
                            </ReactMarkdown>
                        </div>
                    )}
                </main>

                {/* Right panel - file list */}
                <aside className="nr-panel nr-panel-files">
                    <h2>Data Files</h2>
                    {fileSections.length === 0 ? (
                        <p className="nr-muted">No files for this date.</p>
                    ) : (
                        <div className="nr-file-sections">
                            {fileSections.map((section, idx) => (
                                <div key={idx} className="nr-file-section">
                                    <div className="nr-file-section-label">{section.label}</div>
                                    <ul className="nr-file-list">
                                        {section.files.map((f) => (
                                            <li key={f.blobName}>
                                                <button
                                                    className="nr-file-link"
                                                    onClick={() => handleDownload(f.blobName)}
                                                    title={f.blobName}
                                                >
                                                    {f.name}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default App;
