import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getSummary, type TestSummary } from "../api/client";

type SortKey = keyof TestSummary;
type SortDir = "asc" | "desc";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    passed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    error: "bg-red-100 text-red-800",
    skipped: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status === "passed" ? "✅" : status === "failed" ? "❌" : status === "error" ? "⚠️" : "⏭️"}{" "}
      {status}
    </span>
  );
}

function TrendSparkline({ trend }: { trend: string[] }) {
  if (!trend || trend.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex gap-0.5 items-center" title={trend.join(", ")}>
      {trend.map((s, i) => (
        <div
          key={i}
          className={`w-2 h-4 rounded-sm ${
            s === "passed"
              ? "bg-green-500"
              : s === "failed"
                ? "bg-red-500"
                : s === "error"
                  ? "bg-orange-500"
                  : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

function KpiCard({ label, value, threshold, detail, suffix = "" }: {
  label: string;
  value: number;
  threshold: number;
  detail: string;
  suffix?: string;
}) {
  const meets = value >= threshold;
  return (
    <div className={`rounded-lg shadow-sm border p-4 ${meets ? "bg-white" : "bg-red-50 border-red-200"}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${meets ? "text-gray-900" : "text-red-700"}`}>
          {value.toFixed(1)}{suffix}
        </span>
        <span className={`text-xs font-medium ${meets ? "text-green-600" : "text-red-600"}`}>
          {meets ? "✓" : "✗"} {threshold}{suffix} target
        </span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{detail}</div>
    </div>
  );
}

function PassRateBar({ rate, threshold }: { rate: number; threshold?: number }) {
  const color =
    rate >= 90 ? "bg-green-500" : rate >= 70 ? "bg-yellow-500" : "bg-red-500";
  const meetsThreshold = threshold == null || rate >= threshold;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="text-sm font-medium">{rate.toFixed(0)}%</span>
      {threshold != null && (
        <span className={`text-xs ${meetsThreshold ? "text-green-600" : "text-red-600"}`}>
          {meetsThreshold ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}

export default function SummaryTable() {
  const [data, setData] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("skill");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [skillFilter, setSkillFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "integration" | "trigger">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getSummary(7)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const skills = useMemo(
    () => [...new Set(data.map((d) => d.skill))].sort(),
    [data]
  );

  const filtered = useMemo(() => {
    let result = data;
    if (skillFilter) result = result.filter((d) => d.skill === skillFilter);
    if (typeFilter !== "all") result = result.filter((d) => d.testType === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.skill.toLowerCase().includes(q) ||
          (d.prompt || d.testName).toLowerCase().includes(q) ||
          d.testType.toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, skillFilter, typeFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const overallPass = data.length > 0
    ? data.reduce((sum, d) => sum + d.passed, 0)
    : 0;
  const overallTotal = data.reduce((sum, d) => sum + d.totalRuns, 0);
  const overallRate = overallTotal > 0 ? (overallPass / overallTotal) * 100 : 0;

  // Skill invocation rate: pass rate of skill-invocation tests only
  const skillInvTests = data.filter((d) => d.isSkillInvocationTest);
  const skillInvPassed = skillInvTests.reduce((s, d) => s + d.passed, 0);
  const skillInvTotal = skillInvTests.reduce((s, d) => s + d.totalRuns, 0);
  const skillInvRate = skillInvTotal > 0 ? (skillInvPassed / skillInvTotal) * 100 : 0;

  // E2E pass rate (non-skill-invocation tests)
  const e2eTests = data.filter((d) => !d.isSkillInvocationTest);
  const e2ePassed = e2eTests.reduce((s, d) => s + d.passed, 0);
  const e2eTotal = e2eTests.reduce((s, d) => s + d.totalRuns, 0);
  const e2eRate = e2eTotal > 0 ? (e2ePassed / e2eTotal) * 100 : 0;

  // Model (all tests use the same model)
  const model = data.length > 0 ? data[0].model : "unknown";

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
        <h3 className="text-red-800 font-medium">Failed to load data</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Model info bar */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{model}</span>
        <span>•</span>
        <span>{data.length} tests across {skills.length} skills</span>
        <span>•</span>
        <span>{overallTotal} executions (7d)</span>
      </div>

      {/* KPI cards with thresholds */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Skill Invocation Rate"
          value={skillInvRate}
          threshold={80}
          detail={`${skillInvPassed}/${skillInvTotal} runs`}
          suffix="%"
        />
        <KpiCard
          label="E2E Pass Rate"
          value={e2eRate}
          threshold={70}
          detail={`${e2ePassed}/${e2eTotal} runs`}
          suffix="%"
        />
        <KpiCard
          label="Overall Pass Rate"
          value={overallRate}
          threshold={70}
          detail={`${overallPass}/${overallTotal} runs`}
          suffix="%"
        />
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm text-gray-500">Total Tests</div>
          <div className="text-2xl font-bold">{data.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            {skillInvTests.length} invocation · {e2eTests.length} E2E
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All Skills</option>
          {skills.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="all">All Types</option>
          <option value="integration">Integration</option>
          <option value="trigger">Trigger</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skill, prompt, or type…"
          className="border rounded-md px-3 py-1.5 text-sm bg-white flex-1"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {([
                  ["skill", "Skill"],
                  ["testName", "Prompt"],
                  ["testType", "Type"],
                  ["totalRuns", "Runs (7d)"],
                  ["passRate", "Pass Rate"],
                  ["lastStatus", "Last Status"],
                  ["avgDuration", "Avg Duration"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    {label}
                    {sortKey === key && (sortDir === "asc" ? " ▲" : " ▼")}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorted.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">
                    {row.skill}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/test/${encodeURIComponent(row.testName)}`}
                      className="text-blue-600 hover:underline"
                      title={row.prompt ? `Test: ${row.testName}` : undefined}
                    >
                      {row.prompt || row.testName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      row.testType === "integration"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {row.testType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">{row.totalRuns}</td>
                  <td className="px-4 py-3">
                    <PassRateBar
                      rate={row.passRate}
                      threshold={row.isSkillInvocationTest ? 80 : 70}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.lastStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {row.avgDuration.toFixed(1)}s
                  </td>
                  <td className="px-4 py-3">
                    <TrendSparkline trend={row.trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
