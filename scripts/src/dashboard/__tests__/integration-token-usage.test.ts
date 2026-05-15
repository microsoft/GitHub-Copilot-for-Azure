import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DASHBOARD_JS_PATH = resolve(
  import.meta.dirname,
  "../../../../dashboard/assets/dashboard.js",
);

describe("integration token usage dashboard panel", () => {
  const dashboardJs = readFileSync(DASHBOARD_JS_PATH, "utf-8");

  it("includes cached token fields when building average rows", () => {
    expect(dashboardJs).toContain("cacheReadTokens: Math.round((usage.cacheReadTokens || 0) / runCount)");
    expect(dashboardJs).toContain("cacheWriteTokens: Math.round((usage.cacheWriteTokens || 0) / runCount)");
  });

  it("renders cached token counts in the table column", () => {
    expect(dashboardJs).toContain("In / Out / Cache Read / Cache Write / Total");
    expect(dashboardJs).toContain("itoken-cache-read");
    expect(dashboardJs).toContain("itoken-cache-write");
  });
});
