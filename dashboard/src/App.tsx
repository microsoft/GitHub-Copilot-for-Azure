import { Routes, Route, Link, useLocation } from "react-router-dom";
import SummaryTable from "./components/SummaryTable";
import TrendCharts from "./components/TrendCharts";
import TestHistory from "./components/TestHistory";

function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const isActive =
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Integration Test Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              GitHub Copilot for Azure — Skill Quality Metrics
            </p>
          </div>
          <nav className="flex gap-2">
            <NavLink to="/">Summary</NavLink>
            <NavLink to="/trends">Trends</NavLink>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<SummaryTable />} />
          <Route path="/trends" element={<TrendCharts />} />
          <Route path="/test/:testName" element={<TestHistory />} />
        </Routes>
      </main>
    </div>
  );
}
