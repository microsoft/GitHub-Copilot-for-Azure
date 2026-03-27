/**
 * Tests for the JUnit XML tests collector.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { open } from "node:fs/promises";
import testsCollector from "../../collectors/tests.js";
import type { CollectorOptions } from "../../schema.js";

vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  open: vi.fn()
}));

const mockOpen = open as unknown as ReturnType<typeof vi.fn>;

/** Create a mock file-descriptor whose readFile returns `content`. */
function makeMockFd(content: string) {
  return {
    readFile: vi.fn().mockResolvedValue(content),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

const defaultOptions: CollectorOptions = {
  cwd: "/repo",
  timeout: 30_000,
};

const ALL_PASSING_XML = [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<testsuites>",
  "  <testsuite name=\"Suite1\" tests=\"5\" failures=\"0\" errors=\"0\" time=\"1.2\">",
  "    <testcase name=\"test1\" />",
  "  </testsuite>",
  "  <testsuite name=\"Suite2\" tests=\"3\" failures=\"0\" errors=\"0\" time=\"0.8\">",
  "    <testcase name=\"test2\" />",
  "  </testsuite>",
  "</testsuites>",
].join("\n");

const ONE_FAILING_XML = [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<testsuites>",
  "  <testsuite name=\"PassingSuite\" tests=\"5\" failures=\"0\" errors=\"0\" time=\"1.0\">",
  "    <testcase name=\"test1\" />",
  "  </testsuite>",
  "  <testsuite name=\"FailingSuite\" tests=\"3\" failures=\"2\" errors=\"1\" time=\"0.5\">",
  "    <testcase name=\"test2\">",
  "      <failure message=\"assertion failed\" />",
  "    </testcase>",
  "  </testsuite>",
  "</testsuites>",
].join("\n");

// ---------------------------------------------------------------------------
// testsCollector
// ---------------------------------------------------------------------------

describe("testsCollector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct name and version", () => {
    expect(testsCollector.name).toBe("tests");
    expect(testsCollector.version).toBe("1.0.0");
  });

  it("returns skip when JUnit XML does not exist", async () => {
    mockOpen.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items).toHaveLength(1);
    expect(report.items[0].message).toContain("JUnit XML not found");
  });

  it("returns skip for empty file", async () => {
    mockOpen.mockResolvedValue(makeMockFd(""));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("empty");
  });

  it("returns skip for malformed XML", async () => {
    mockOpen.mockResolvedValue(makeMockFd("   "));

    const report = await testsCollector.collect(defaultOptions);

    // Whitespace-only is treated as empty → skip
    expect(report.status).toBe("skip");
  });

  it("returns skip when XML has no test suites", async () => {
    mockOpen.mockResolvedValue(makeMockFd(
      "<?xml version=\"1.0\"?><other>content</other>"
    ));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
    expect(report.items[0].message).toContain("No test suites");
  });

  it("returns pass with correct items for all-passing suites", async () => {
    mockOpen.mockResolvedValue(makeMockFd(ALL_PASSING_XML));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(2);

    expect(report.items[0].name).toBe("Suite1");
    expect(report.items[0].status).toBe("pass");
    expect(report.items[0].metadata).toEqual({
      tests: 5,
      failures: 0,
      errors: 0,
      time: 1.2,
    });

    expect(report.items[1].name).toBe("Suite2");
    expect(report.items[1].status).toBe("pass");

    expect(report.summary.total).toBe(2);
    expect(report.summary.passed).toBe(2);
    expect(report.summary.failed).toBe(0);
  });

  it("returns fail when one suite has failures", async () => {
    mockOpen.mockResolvedValue(makeMockFd(ONE_FAILING_XML));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("fail");
    expect(report.items).toHaveLength(2);
    expect(report.items[0].status).toBe("pass");
    expect(report.items[1].status).toBe("fail");
    expect(report.items[1].metadata?.failures).toBe(2);
    expect(report.items[1].metadata?.errors).toBe(1);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
  });

  it("handles single testsuite without wrapper element", async () => {
    const xml = [
      "<testsuite name=\"Solo\" tests=\"1\" failures=\"0\" errors=\"0\" time=\"0.1\">",
      "  <testcase name=\"only\" />",
      "</testsuite>",
    ].join("\n");
    mockOpen.mockResolvedValue(makeMockFd(xml));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("pass");
    expect(report.items).toHaveLength(1);
    expect(report.items[0].name).toBe("Solo");
  });

  it("returns valid collectorVersion and collectedAt", async () => {
    mockOpen.mockResolvedValue(makeMockFd(ALL_PASSING_XML));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.collectorVersion).toBe("1.0.0");
    expect(new Date(report.collectedAt).getTime()).not.toBeNaN();
  });

  it("returns skip when readFile throws", async () => {
    const fd = {
      readFile: vi.fn().mockRejectedValue(new Error("Permission denied")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockOpen.mockResolvedValue(fd);

    const report = await testsCollector.collect(defaultOptions);

    expect(report.status).toBe("skip");
  });

  it("sanitizes suite names", async () => {
    const xml = [
      "<testsuites>",
      "  <testsuite name=\"<script>alert('xss')</script>\" tests=\"1\" failures=\"0\" errors=\"0\" time=\"0.1\">",
      "    <testcase name=\"t\" />",
      "  </testsuite>",
      "</testsuites>",
    ].join("\n");
    mockOpen.mockResolvedValue(makeMockFd(xml));

    const report = await testsCollector.collect(defaultOptions);

    expect(report.items[0].name).not.toContain("<script>");
  });
});
