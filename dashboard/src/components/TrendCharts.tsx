import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { getTrends, type TrendPoint } from "../api/client";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SKILL_COLORS: Record<string, string> = {
  "azure-rbac": "#3b82f6",
  "azure-prepare": "#10b981",
  "azure-deploy": "#f59e0b",
  "azure-validate": "#8b5cf6",
  "azure-ai": "#ef4444",
  "azure-storage": "#06b6d4",
  "azure-observability": "#f97316",
  "azure-diagnostics": "#ec4899",
  "azure-compliance": "#14b8a6",
  "azure-cost-optimization": "#6366f1",
  "microsoft-foundry": "#84cc16",
};

function getColor(skill: string): string {
  return SKILL_COLORS[skill] || `hsl(${hashCode(skill) % 360}, 65%, 55%)`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function TrendCharts() {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTrends(7)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  // Group by skill
  const skills = [...new Set(data.map((d) => d.skill))].sort();
  const runDates = [...new Set(data.map((d) => d.runDate))].sort();

  // Pass rate per skill over time
  const passRateData = {
    labels: runDates.map((d) =>
      new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" })
    ),
    datasets: skills.map((skill) => {
      const color = getColor(skill);
      return {
        label: skill,
        data: runDates.map((date) => {
          const point = data.find((d) => d.skill === skill && d.runDate === date);
          return point?.passRate ?? null;
        }),
        borderColor: color,
        backgroundColor: color + "20",
        tension: 0.3,
        spanGaps: true,
      };
    }),
  };

  // Aggregate pass/fail stacked area
  const aggregated = runDates.map((date) => {
    const points = data.filter((d) => d.runDate === date);
    return {
      date,
      passed: points.reduce((s, p) => s + p.passed, 0),
      failed: points.reduce((s, p) => s + p.failed, 0),
      errors: points.reduce((s, p) => s + p.errors, 0),
    };
  });

  const stackedData = {
    labels: runDates.map((d) =>
      new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" })
    ),
    datasets: [
      {
        label: "Passed",
        data: aggregated.map((a) => a.passed),
        borderColor: "#22c55e",
        backgroundColor: "#22c55e40",
        fill: true,
      },
      {
        label: "Failed",
        data: aggregated.map((a) => a.failed),
        borderColor: "#ef4444",
        backgroundColor: "#ef444440",
        fill: true,
      },
      {
        label: "Errors",
        data: aggregated.map((a) => a.errors),
        borderColor: "#f97316",
        backgroundColor: "#f9731640",
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-8">
      {/* Pass rate per skill */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">
          Pass Rate by Skill (Last 7 Days)
        </h2>
        <div className="h-96">
          <Line
            data={passRateData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  min: 0,
                  max: 100,
                  title: { display: true, text: "Pass Rate %" },
                },
              },
              plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12 } },
                tooltip: {
                  callbacks: {
                    label: (ctx) =>
                      `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%`,
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Aggregate pass/fail */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">
          Total Test Outcomes Per Run
        </h2>
        <div className="h-80">
          <Line
            data={stackedData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  stacked: true,
                  title: { display: true, text: "Test Count" },
                },
              },
              plugins: {
                legend: { position: "bottom" },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
