import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FileViewer from "./FileViewer";
import type { BlobEntry, BlobTree, BlobTreeNode } from "../shared/blobTree";
import { apiUrl, getPersistedPluginSelection, pageUrl } from "../shared/apiUrl";
import PluginSelector from "../shared/PluginSelector";

interface FileSection {
    label: string;
    files: BlobEntry[];
}

function sectionIdFromLabel(label: string): string {
    const lastSegment = label.split(" / ").pop() ?? label;
    return lastSegment.replace(/\s+/g, "_").replace(/_+/g, "_");
}

/**
 * Organizes files into sections based on their path hierarchy.
 * Sections are labeled with run ID / skill name / group or test case name.
 */
function organizeFilesIntoSections(dateNode: BlobTreeNode, selectedSkill: string): FileSection[] {
    const sections: FileSection[] = [];

    for (const [runId, runNode] of Object.entries(dateNode.children)) {
        for (const [skillName, skillNode] of Object.entries(runNode.children)) {
            if (skillName !== selectedSkill) {
                continue;
            }

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

export function skillNamesFromDateNode(dateNode: BlobTreeNode): string[] {
    const skillNames = new Set<string>();
    for (const runNode of Object.values(dateNode.children)) {
        for (const skillName of Object.keys(runNode.children)) {
            skillNames.add(skillName);
        }
    }
    return [...skillNames].sort((a, b) => a.localeCompare(b));
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
    const [selectedPlugin, setSelectedPlugin] = useState<string>(getPersistedPluginSelection);
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [skillNames, setSkillNames] = useState<string[]>([]);
    const [selectedSkill, setSelectedSkill] = useState("");
    const [cachedDateNode, setCachedDateNode] = useState<BlobTreeNode | null>(null);
    const [reportMarkdown, setReportMarkdown] = useState<string>("");
    const [fileSections, setFileSections] = useState<FileSection[]>([]);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                    const params = new URLSearchParams(window.location.search);
                    const requested = params.get("date");
                    setSelectedDate(requested && data.includes(requested) ? requested : data[0]);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingDates(false));
    }, [selectedPlugin]);

    // Fetch data when a date is selected
    useEffect(() => {
        if (!selectedDate) return;

        setError(null);
        setLoadingData(true);
        setFileSections([]);
        setSkillNames([]);
        setSelectedSkill("");
        setCachedDateNode(null);

        fetch(apiUrl(`/api/data/${encodeURIComponent(selectedDate)}`))
            .then((res) => {
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                return res.json();
            })
            .then((data: BlobTree) => {
                const dateNode = data[selectedDate];
                if (dateNode) {
                    const availableSkillNames = skillNamesFromDateNode(dateNode);
                    setCachedDateNode(dateNode);
                    setSkillNames(availableSkillNames);
                    setSelectedSkill(availableSkillNames[0] ?? "");
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingData(false));
    }, [selectedDate, selectedPlugin]);

    useEffect(() => {
        setFileSections(
            cachedDateNode && selectedSkill
                ? organizeFilesIntoSections(cachedDateNode, selectedSkill)
                : [],
        );
    }, [cachedDateNode, selectedSkill]);

    // Fetch reports when the date or skill selection changes
    useEffect(() => {
        if (!selectedDate || !selectedSkill) {
            setLoadingReport(false);
            setReportMarkdown("");
            return;
        }

        const controller = new AbortController();
        setLoadingReport(true);
        setReportMarkdown("");

        fetch(apiUrl(`/api/reports/${encodeURIComponent(selectedDate)}?skill=${encodeURIComponent(selectedSkill)}`), {
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load reports: ${res.status}`);
                return res.text();
            })
            .then((md) => setReportMarkdown(md))
            .catch((err) => {
                if (err.name !== "AbortError") {
                    setReportMarkdown(`*Error loading reports: ${err.message}*`);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoadingReport(false);
                }
            });

        return () => controller.abort();
    }, [selectedDate, selectedPlugin, selectedSkill]);

    const handleDownload = useCallback((blobName: string) => {
        const viewerUrl = pageUrl(`${window.location.pathname}?file=${encodeURIComponent(blobName)}`);
        window.open(viewerUrl, "_blank");
    }, []);

    // Update browser tab title with selected date
    useEffect(() => {
        document.title = selectedDate ? `Nightly Runs ${selectedDate}` : "Nightly Runs";
    }, [selectedDate]);

    // Auto-scroll the right panel to the section matching the URL fragment
    useEffect(() => {
        if (fileSections.length === 0) return;
        const hash = window.location.hash.slice(1);
        if (!hash) return;
        const el = document.getElementById(decodeURIComponent(hash));
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [fileSections]);

    if (loadingDates) {
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

            <PluginSelector
                selectedPlugin={selectedPlugin}
                onChange={(plugin) => {
                    setSelectedSkill("");
                    setSelectedPlugin(plugin);
                }}
            >
                <label className="plugin-toolbar__field">
                    <span className="plugin-toolbar__label">Skill</span>
                    <select
                        className="plugin-toolbar__select"
                        value={selectedSkill}
                        onChange={(event) => setSelectedSkill(event.target.value)}
                        disabled={loadingData || skillNames.length === 0}
                    >
                        {skillNames.map((skillName) => (
                            <option key={skillName} value={skillName}>
                                {skillName}
                            </option>
                        ))}
                    </select>
                </label>
            </PluginSelector>

            <div className="nr-body">
                {/* Left panel - date list */}
                <aside className="nr-panel nr-panel-dates">
                    <h2>Dates</h2>
                    <ul className="nr-date-list">
                        {dates.map((d) => (
                            <li key={d}>
                                <button
                                    className={`nr-date-link${d === selectedDate ? " active" : ""}`}
                                    onClick={() => {
                                        setSelectedSkill("");
                                        setSelectedDate(d);
                                    }}
                                >
                                    {d}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Center panel - skill reports */}
                <main className="nr-panel nr-panel-reports">
                    <h2>
                        {selectedSkill || "Skill Reports"} &mdash; {selectedDate ?? "none"}
                    </h2>
                    {loadingReport || loadingData ? (
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
                        <p className="nr-muted">No files for this skill.</p>
                    ) : (
                        <div className="nr-file-sections">
                            {fileSections.map((section, idx) => (
                                <div key={idx} className="nr-file-section" id={sectionIdFromLabel(section.label)}>
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
