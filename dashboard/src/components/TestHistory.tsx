import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTestHistory, getTestSummary, type TestHistoryEntry, type TestSummary } from "../api/client";

const REPO_URL = "https://github.com/microsoft/GitHub-Copilot-for-Azure";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "passed":
      return <span className="text-green-600 font-bold">✅</span>;
    case "failed":
      return <span className="text-red-600 font-bold">❌</span>;
    case "error":
      return <span className="text-orange-600 font-bold">⚠️</span>;
    case "skipped":
      return <span className="text-yellow-600">⏭️</span>;
    default:
      return <span className="text-gray-400">?</span>;
  }
}

export default function TestHistory() {
  const { testName } = useParams<{ testName: string }>();
  const decodedName = decodeURIComponent(testName || "");
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    if (!decodedName) return;
    Promise.all([
      getTestHistory(decodedName, 7),
      getTestSummary(decodedName),
    ])
      .then(([h, s]) => { setHistory(h); setSummary(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [decodedName]);

  const passCount = history.filter((d) => d.status === "passed").length;
  const passRate = history.length > 0 ? (passCount / history.length) * 100 : 0;

  // Determine trend direction
  const recentHalf = history.slice(0, Math.ceil(history.length / 2));
  const olderHalf = history.slice(Math.ceil(history.length / 2));
  const recentRate =
    recentHalf.length > 0
      ? recentHalf.filter((d) => d.status === "passed").length / recentHalf.length
      : 0;
  const olderRate =
    olderHalf.length > 0
      ? olderHalf.filter((d) => d.status === "passed").length / olderHalf.length
      : 0;
  const trendDirection =
    recentRate > olderRate ? "improving" : recentRate < olderRate ? "degrading" : "stable";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          ← Back to Summary
        </Link>
      </div>

      {/* Test info header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {decodedName}
            </h2>
            {summary?.prompt && (
              <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-3">
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Prompt</span>
                <p className="text-sm text-blue-900 mt-0.5 italic">"{summary.prompt}"</p>
              </div>
            )}
          </div>
          {summary?.sourceFile && (
            <a
              href={`${REPO_URL}/blob/main/${summary.sourceFile}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-md border transition-colors"
            >
              📄 View Test Source
            </a>
          )}
        </div>
        <div className="flex gap-6 text-sm mb-4">
          <div>
            <span className="text-gray-500">Skill:</span>{" "}
            <span className="font-medium text-blue-600">{summary?.skill}</span>
          </div>
          <div>
            <span className="text-gray-500">Type:</span>{" "}
            <span className="font-medium">{summary?.testType}</span>
          </div>
          {summary?.testCategory && (
            <div>
              <span className="text-gray-500">Category:</span>{" "}
              <span className="font-medium">{summary.testCategory}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Model:</span>{" "}
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{summary?.model || "unknown"}</span>
          </div>
          <div>
            <span className="text-gray-500">Pass Rate (7d):</span>{" "}
            <span className="font-medium">{passRate.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-gray-500">Runs:</span>{" "}
            <span className="font-medium">{history.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Trend:</span>{" "}
            <span
              className={`font-medium ${
                trendDirection === "improving"
                  ? "text-green-600"
                  : trendDirection === "degrading"
                    ? "text-red-600"
                    : "text-gray-600"
              }`}
            >
              {trendDirection === "improving"
                ? "▲ Improving"
                : trendDirection === "degrading"
                  ? "▼ Degrading"
                  : "─ Stable"}
            </span>
          </div>
        </div>

        {/* Assertions & Expected behavior */}
        {summary && (summary.assertions.length > 0 || summary.expectedKeywords.length > 0 || summary.expectedTools.length > 0) && (
          <div className="border-t pt-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              What This Test Validates
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.assertions.map((a, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Run Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Links
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((entry, i) => (
              <tr key={`row-${i}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
                <td className="px-4 py-3">
                  <StatusIcon status={entry.status} />
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Date(entry.runDate).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {entry.duration.toFixed(1)}s
                </td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <a
                    href={entry.runUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Run
                  </a>
                  {entry.jobUrl && (
                    <a
                      href={entry.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Job
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {expandedRow !== null && history[expandedRow]?.failureMessage && (
              <tr key="expanded-detail">
                <td colSpan={4} className="px-4 py-3 bg-red-50">
                  <pre className="text-xs text-red-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {history[expandedRow].failureMessage}
                  </pre>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
