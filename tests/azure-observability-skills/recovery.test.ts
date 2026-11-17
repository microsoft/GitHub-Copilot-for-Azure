import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixture, Runtime } from "./runtime";

interface Evidence {
  state: string;
  complete: boolean;
  source: string;
  query_ref: string;
  collected_at: string;
  window_start: string;
  window_end: string;
  first_event_at: string | null;
  latest_event_at: string | null;
  sample_count: number | null;
  total: number | null;
  workload: string;
  version: string;
  percentile?: number;
  percentile_value?: number | null;
}
interface Check {
  id: string;
  target: string;
  role: string;
  required: boolean;
  metric: string;
  kind: string;
  unit: string;
  operator: string;
  threshold: number;
  expected_workload: string;
  comparable: boolean;
  min_samples: number;
  min_observation_seconds: number;
  freshness_seconds: number;
  percentile?: number;
  original: Evidence;
  post: Evidence;
}
interface Recovery {
  schema_version: number;
  incident: string;
  scope: { environment: string; targets: string[]; confirmed: boolean; confirmed_at: string };
  change: { id: string; version: string; deployed_at: string; confirmed: boolean };
  evaluated_at: string;
  max_evidence_age_seconds: number;
  checks: Check[];
  supporting_results: { kind: string; reference: string; state: string }[];
}
interface Result {
  verdict: string;
  reasons: string[];
  checks: { verdict: string; reasons: string[]; original_value: number | null;
    post_value: number | null; delta: number | null }[];
  supporting_results_establish_recovery: boolean;
}

const now = "2026-10-30T12:00:00Z";
const skill = "verify-observability-fix";
let runtime: Runtime;
let input: Recovery;
let check: Check;
const assess = (at = now): Result => runtime.assess(skill, "recovery.py", input, at);
const unavailable = (evidence: Evidence, state: string): void => {
  Object.assign(evidence, {
    state, complete: state === "empty", sample_count: state === "empty" ? 0 : null,
    total: state === "empty" ? 0 : null, first_event_at: null, latest_event_at: null,
  });
};

beforeEach(() => {
  runtime = new Runtime();
  input = fixture<Recovery>("recovery.json");
  check = input.checks[0];
});
afterEach(() => runtime.cleanup());

describe("recovery evidence and precedence", () => {
  it("compares measured fractions rather than query row counts", () => {
    const result = assess();
    expect(result.verdict).toBe("VERIFIED_RECOVERED");
    expect(result.checks[0]).toMatchObject({ original_value: 0.2, post_value: 0.01 });
    expect(result.checks[0].delta).toBeCloseTo(-0.19);
    expect(result.supporting_results_establish_recovery).toBe(false);
  });

  it("compares measured sums for means", () => {
    Object.assign(check, { kind: "mean", unit: "milliseconds", threshold: 100 });
    check.original.total = 20000;
    check.post.total = 5000;
    expect(assess()).toMatchObject({
      verdict: "VERIFIED_RECOVERED", checks: [{ original_value: 200, post_value: 50 }],
    });
  });

  it.each([
    ["lte", 0.02, 2, "VERIFIED_RECOVERED"], ["lte", 0.02, 3, "NOT_RECOVERED"],
    ["gte", 0.98, 98, "VERIFIED_RECOVERED"], ["gte", 0.98, 97, "NOT_RECOVERED"],
  ] as const)("honors %s threshold %s at numerator %s", (operator, threshold, total, verdict) => {
    Object.assign(check, { operator, threshold });
    check.post.total = total;
    expect(assess().verdict).toBe(verdict);
  });

  it.each(["missing", "denied", "partial", "failed", "unsupported", "empty", "stale", "throttled", "unverified"])(
    "never calls %s post-change evidence recovered", (state) => {
      unavailable(check.post, state);
      const result = assess();
      expect(result.verdict).toBe("INCONCLUSIVE");
      expect(result.checks[0].reasons).toContain(`post_source_${state}`);
    },
  );

  it.each(["failed", "partial", "unknown"])(
    "unresolved %s support blocks recovery but cannot hide sufficient failure", (state) => {
      input.supporting_results[0].state = state;
      expect(assess()).toMatchObject({
        verdict: "INCONCLUSIVE", reasons: ["unresolved_supporting_evidence"],
      });
      check.post.total = 20;
      expect(assess().verdict).toBe("NOT_RECOVERED");
    },
  );

  it("deployment and evaluation success cannot substitute for measurements", () => {
    unavailable(check.post, "missing");
    expect(assess().verdict).toBe("INCONCLUSIVE");
  });

  it("a current violation wins over missing baseline and unrelated denied guardrail", () => {
    const guardrail = structuredClone(check);
    Object.assign(guardrail, { id: "guardrail", role: "guardrail" });
    unavailable(guardrail.post, "denied");
    input.checks.push(guardrail);
    unavailable(check.original, "missing");
    check.post.total = 20;
    const result = assess();
    expect(result.verdict).toBe("NOT_RECOVERED");
    expect(result.checks[0].delta).toBeNull();
    expect(result.checks[1].verdict).toBe("INCONCLUSIVE");
  });

  it("a required guardrail violation wins even when the original symptom is unavailable", () => {
    const guardrail = structuredClone(check);
    Object.assign(guardrail, { id: "guardrail", role: "guardrail" });
    guardrail.post.total = 20;
    input.checks.push(guardrail);
    unavailable(check.original, "denied");
    expect(assess().verdict).toBe("NOT_RECOVERED");
  });

  it("optional failed checks do not gate required recovery", () => {
    const optional = structuredClone(check);
    Object.assign(optional, { id: "optional", required: false });
    optional.post.total = 20;
    input.checks.push(optional);
    expect(assess()).toMatchObject({
      verdict: "VERIFIED_RECOVERED",
      checks: [{ verdict: "VERIFIED_RECOVERED" }, { verdict: "NOT_RECOVERED" }],
    });
  });

  it.each(["empty", "optional-only", "guardrail-only", "uncovered-target", "passing-baseline"])(
    "requires a proven original symptom for each target: %s", (plan) => {
      if (plan === "empty") input.checks = [];
      if (plan === "optional-only") check.required = false;
      if (plan === "guardrail-only") check.role = "guardrail";
      if (plan === "uncovered-target") input.scope.targets.push("second-target");
      if (plan === "passing-baseline") check.original.total = 1;
      expect(assess().verdict).toBe("INCONCLUSIVE");
    },
  );

  it.each(["scope", "change"] as const)("requires confirmed %s even for current violations", (key) => {
    input[key].confirmed = false;
    check.post.total = 90;
    expect(assess().verdict).toBe("INCONCLUSIVE");
  });

  it.each(["version", "workload"] as const)("rejects an unrelated post-change %s", (key) => {
    check.post[key] = "different";
    check.post.total = 90;
    expect(assess().verdict).toBe("INCONCLUSIVE");
  });

  it("does not compare different cohorts or incomplete measurements", () => {
    check.comparable = false;
    check.post.total = 90;
    expect(assess().verdict).toBe("INCONCLUSIVE");
    check.comparable = true;
    check.post.complete = false;
    expect(assess().verdict).toBe("INCONCLUSIVE");
  });
});

describe("recovery windows and percentiles", () => {
  it.each([
    ["insufficient samples", (c: Check) => { c.min_samples = 101; }],
    ["insufficient actual span", (c: Check) => { c.post.first_event_at = "2026-10-30T11:58:00Z"; }],
    ["insufficient window", (c: Check) => { c.min_observation_seconds = 3601; }],
    ["missing aggregate", (c: Check) => { c.post.total = null; }],
    ["stale original", (c: Check) => { c.original.latest_event_at = "2026-10-30T10:55:00Z"; }],
  ] as const)("does not mistake %s for recovery", (_name, mutate) => {
    mutate(check);
    expect(assess().verdict).toBe("INCONCLUSIVE");
  });

  it("uses the current assessment clock for event freshness and collection expiry", () => {
    expect(assess("2026-10-30T12:01:01Z").checks[0].reasons).toContain("post_stale_or_missing_events");
    expect(assess("2026-10-30T12:05:01Z").verdict).toBe("INCONCLUSIVE");
  });

  it("accepts inclusive freshness, sample, span and reuse boundaries", () => {
    Object.assign(check, { freshness_seconds: 360, min_observation_seconds: 3480 });
    expect(assess("2026-10-30T12:05:00Z").verdict).toBe("VERIFIED_RECOVERED");
  });

  it("compares p95 aggregates, not mean or total", () => {
    input = fixture<Recovery>("recovery-p95.json");
    const result = assess();
    expect(result).toMatchObject({
      verdict: "VERIFIED_RECOVERED",
      checks: [{ original_value: 12000, post_value: 4000, delta: -8000 }],
    });
    input.checks[0].post.percentile_value = 5001;
    expect(assess().verdict).toBe("NOT_RECOVERED");
  });

  it.each(["mismatched percentile", "missing percentile", "too few samples"])(
    "cannot verify p95 with %s", (gap) => {
      input = fixture<Recovery>("recovery-p95.json");
      const post = input.checks[0].post;
      if (gap === "mismatched percentile") post.percentile = 99;
      if (gap === "missing percentile") post.percentile_value = null;
      if (gap === "too few samples") post.sample_count = 249;
      expect(assess().verdict).toBe("INCONCLUSIVE");
    },
  );

  it.each([
    ["original", "window_end", "2026-10-30T11:01:00Z"],
    ["post", "window_start", "2026-10-30T10:59:00Z"],
    ["post", "collected_at", "2026-10-30T11:59:00Z"],
    ["post", "collected_at", "2026-10-30T12:00:01Z"],
    ["post", "first_event_at", "2026-10-30T10:00:00Z"],
    ["post", "latest_event_at", "2026-10-30T12:00:01Z"],
  ] as const)("rejects invalid chronology %s.%s=%s", (window, key, time) => {
    check[window][key] = time;
    const result = runtime.run(skill, "recovery.py", [runtime.json(input)]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });
});

describe("recovery input validation", () => {
  it.each([true, false, -1, "1", null, 2])("rejects invalid threshold %s", (threshold) => {
    const result = runtime.run(skill, "recovery.py", [runtime.json({
      ...input, checks: [{ ...check, threshold }],
    })]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });

  it.each([
    '{"secret":"never-echo",}', '{"token":1,"token":2}', '{"value":NaN}',
    '{"value":Infinity}', " ".repeat(128 * 1024 + 1),
  ])("rejects malformed, duplicate, nonfinite or oversized JSON %#", (text) => {
    const result = runtime.run(skill, "recovery.py", [runtime.file(text)]);
    expect(result.status).toBe(2);
    expect(result.stderr).not.toContain("never-echo");
    expect(result.stdout).toBe("");
  });

  it("rejects unexpected fields without exposing their values", () => {
    const result = runtime.run(skill, "recovery.py", [runtime.json({
      ...input, token: "synthetic-secret-never-echo",
    })]);
    expect(result.status).toBe(2);
    expect(result.stderr).not.toContain("synthetic-secret-never-echo");
  });

  it("rejects invalid UTF-8 and missing paths without leaking the path", () => {
    expect(runtime.run(skill, "recovery.py", [runtime.file(Buffer.from([0xff]))]).status).toBe(2);
    const result = runtime.run(skill, "recovery.py", ["private-missing-file.json"]);
    expect(result.status).toBe(2);
    expect(result.stderr).not.toContain("private-missing-file");
  });
});
