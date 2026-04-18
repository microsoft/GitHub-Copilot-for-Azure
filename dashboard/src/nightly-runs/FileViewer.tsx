import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FileViewerProps {
    blobPath: string;
}

function FileViewer({ blobPath }: FileViewerProps) {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fileName = blobPath.split("/").pop() ?? "file";
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

    useEffect(() => {
        document.title = "agentMetadata";
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setContent("");

        fetch(`/api/download?path=${encodeURIComponent(blobPath)}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
                return res.text();
            })
            .then((text) => setContent(text))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [blobPath]);

    const handleDownload = () => {
        window.open(`/api/download?path=${encodeURIComponent(blobPath)}`, "_blank");
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    };

    const renderContent = () => {
        if (loading) {
            return <p>Loading file&hellip;</p>;
        }

        if (error) {
            return <p className="nr-error">Error: {error}</p>;
        }

        if (extension === "md") {
            return (
                <div className="nr-markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
            );
        }

        if (extension === "json") {
            try {
                const parsed = JSON.parse(content);
                const formatted = JSON.stringify(parsed, null, 2);
                return <pre className="nr-code-content">{formatted}</pre>;
            } catch {
                return <pre className="nr-code-content">{content}</pre>;
            }
        }

        return <pre className="nr-code-content">{content}</pre>;
    };

    return (
        <div className="nr-file-viewer" id="main">
            <header className="nr-file-viewer-header">
                <div className="nr-file-viewer-title">
                    <button className="nr-back-button" onClick={handleBack} title="Go back">
                        &larr; Back
                    </button>
                    <h1>{fileName}</h1>
                </div>
                <div className="nr-file-viewer-actions">
                    <button className="nr-download-button" onClick={handleDownload}>
                        &darr; Download
                    </button>
                </div>
            </header>
            <main className="nr-file-viewer-content">{renderContent()}</main>
        </div>
    );
}

export default FileViewer;
