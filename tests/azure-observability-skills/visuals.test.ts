import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Runtime } from "./runtime";

const skill = "assess-observability-health";
let runtime: Runtime;
beforeEach(() => { runtime = new Runtime(); });
afterEach(() => runtime.cleanup());

function visual() {
  return {
    title: "Synthetic API health",
    window: { start: "2026-10-10T00:00:00Z", end: "2026-10-10T01:00:00Z" },
    source_summary: "Supplied sanitized evidence",
    kpis: [{ label: "Requests", value: "Degraded", context: "12 failed dependencies", state: "degraded" }],
    charts: [{
      title: "Latency", caption: "Comparable cohort", maximum: 25,
      series: [{ name: "p95 seconds", points: [
        { x: "Baseline", y: 20, display: "20 s", state: "degraded" },
        { x: "Current", y: 4, display: "4 s", state: "healthy" },
      ] }],
      annotations: [{ label: "Gate: p95 < 5 s", y: 5, state: "healthy" }],
    }],
    infrastructure_metrics: [{ label: "Cache", value: "Unavailable", context: "Access denied", state: "neutral" }],
  };
}
function render(value: unknown, theme = "dark") {
  const output = join(runtime.root, "summary.svg");
  const result = runtime.run(skill, "render_inline_health_visual.py", [
    "--input", runtime.json(value), "--output", output, "--theme", theme,
  ]);
  return { ...result, svg: existsSync(output) ? readFileSync(output, "utf8") : "" };
}

describe("health visual renderer", () => {
  it("preserves measured comparisons, gate annotation and unavailable infrastructure", () => {
    const result = render(visual());
    expect(result.status).toBe(0);
    expect(result.svg).toContain(">Baseline<");
    expect(result.svg).toContain(">Current<");
    expect(result.svg).toContain("Gate: p95 &lt; 5 s");
    expect(result.svg).toContain("Access denied");
    expect(result.svg).toContain("Unavailable");
  });

  it("escapes untrusted labels and never interpolates unknown state into markup", () => {
    const input = visual();
    const malicious = '<script>alert("synthetic")</script>&';
    input.title = malicious;
    input.source_summary = malicious;
    input.kpis[0].label = malicious;
    input.kpis[0].state = '" onload="alert(1)';
    input.charts[0].title = malicious;
    input.charts[0].annotations[0].label = malicious;
    input.charts[0].series[0].points[0].display = malicious;
    input.infrastructure_metrics[0].label = malicious;
    const result = render(input);
    expect(result.status).toBe(0);
    expect(result.svg).toContain("&lt;script&gt;");
    expect(result.svg).not.toContain("<script>");
    expect(result.svg).not.toContain("onload=");
  });

  it("renders missing signals as unavailable, not healthy", () => {
    const input = visual();
    input.kpis = [];
    input.charts = [];
    input.infrastructure_metrics = [];
    const result = render(input);
    expect(result.status).toBe(0);
    expect(result.svg).toContain("Unavailable");
    expect(result.svg).not.toMatch(/>Healthy</);
  });

  it("handles all-zero series without dividing by zero", () => {
    const input = visual();
    input.charts[0].series[0].points.forEach((point) => { point.y = 0; });
    const result = render(input);
    expect(result.status).toBe(0);
    expect(result.svg).not.toMatch(/\b(?:NaN|Infinity)\b/);
  });

  it.each(["auto", "light", "dark"])("supports legacy %s theme without changing the evidence", (theme) => {
    const result = render(visual(), theme);
    expect(result.status).toBe(0);
    expect(result.svg).toContain("color-scheme: dark");
    expect(result.svg).toContain("12 failed dependencies");
  });

  it("fails rather than publishing an SVG for nonnumeric chart evidence", () => {
    const input = visual();
    const invalid = {
      ...input, charts: [{
        ...input.charts[0], series: [{ name: "invalid", points: [{ x: "Current", y: "not-a-number" }] }],
      }],
    };
    const result = render(invalid);
    expect(result.status).not.toBe(0);
    expect(result.svg).toBe("");
  });

  it("fails on malformed JSON without producing an artifact", () => {
    const output = join(runtime.root, "summary.svg");
    const result = runtime.run(skill, "render_inline_health_visual.py", [
      "--input", runtime.file("{"), "--output", output,
    ]);
    expect(result.status).not.toBe(0);
    expect(existsSync(output)).toBe(false);
  });
});

const eventId = "22222222-2222-4222-8222-222222222222";
const resourceId = "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/synthetic/providers/microsoft.insights/components/synthetic";
function traceArgs(overrides: Record<string, string> = {}): string[] {
  return Object.entries({
    "subscription-id": "11111111-1111-1111-1111-111111111111",
    "resource-group": "synthetic", "component-name": "synthetic",
    "resource-id": resourceId, "event-id": eventId, "operation-id": "synthetic-operation",
    timestamp: "2026-10-09T23:15:38Z", "event-table": "requests", "end-time": "2026-10-10T00:00:00Z",
    ...overrides,
  }).flatMap(([key, value]) => [`--${key}`, value]);
}
describe("Application Insights trace links", () => {
  it("encodes component and telemetry identity semantically, without asserting a copied URL hash", () => {
    const run = () => runtime.run(skill, "build_appinsights_trace_link.py", traceArgs());
    const result = run();
    expect(result.status).toBe(0);
    const first = JSON.parse(result.stdout) as { ok: boolean; url: string; cache_id: string };
    expect(first.ok).toBe(true);
    const url = new URL(first.url);
    expect(url.origin).toBe("https://portal.azure.com");
    const [component, data] = url.hash.split("ComponentId~/")[1].split("/DataModel~/");
    expect(JSON.parse(decodeURIComponent(component))).toMatchObject({
      ResourceId: encodeURIComponent(resourceId), Name: "synthetic",
    });
    expect(JSON.parse(decodeURIComponent(data))).toMatchObject({
      eventId, operationId: "synthetic-operation", eventTable: "requests",
      timeContext: { durationMs: 86400000, endTime: "2026-10-10T00:00:00Z" },
    });
    expect((JSON.parse(run().stdout) as { cache_id: string }).cache_id).toBe(first.cache_id);
  });

  it.each<Record<string, string>>([
    { "event-id": "496b1462e33f087b" },
    { timestamp: "not-a-time" },
    { "end-time": "2026-02-30T12:00:00Z" },
    { "event-table": "untrusted-table" },
    { "duration-ms": "0" },
    { "duration-ms": "-1" },
  ])("rejects invalid telemetry identity, time, table or duration %#", (overrides) => {
    const result = runtime.run(skill, "build_appinsights_trace_link.py", traceArgs(overrides));
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("https://portal.azure.com");
  });
});
