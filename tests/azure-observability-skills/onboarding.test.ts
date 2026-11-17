import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixture, Runtime } from "./runtime";

interface Mapping {
  schema_version: number;
  application: string;
  environment: string;
  workload: string;
  confirmed_at: string;
  resources: { resource_id: string; basis: string }[];
  telemetry_sources: { resource_id: string; kind: string; basis: string }[];
}
interface Signal {
  name: string;
  source_resource_id: string;
  required: boolean;
  state: string;
  checked_at: string;
  window_start: string;
  window_end: string;
  freshness_seconds: number;
  record_count: number | null;
  latest_event_at: string | null;
  complete: boolean;
}
interface Onboarding {
  schema_version: number;
  mapping: Mapping;
  checked_at: string;
  max_check_age_seconds: number;
  prerequisites: { tools: string; identity: string; mapping: string };
  signals: Signal[];
}
interface Readiness {
  readiness: string;
  basis: string;
  reasons: string[];
  signals: (Signal & { effective_state: string })[];
}
const skill = "connect-observability";
const now = "2026-10-29T12:00:00Z";
let runtime: Runtime;
let input: Onboarding;
const assess = (at = now): Readiness => runtime.assess(skill, "onboarding.py", input, at);
const cli = (command: string, value: unknown, ...args: string[]) =>
  runtime.run(skill, "onboarding.py", [command, runtime.json(value), ...args]);
const save = (...args: string[]) =>
  cli("save", input.mapping, "--project", runtime.root, ...args);
const prepare = (ignored = true): void => {
  runtime.git("init", "--quiet");
  if (ignored) writeFileSync(join(runtime.root, ".gitignore"), ".obs/\n");
};
const unavailable = (signal: Signal, state: string): void => {
  Object.assign(signal, {
    state, complete: state === "empty", record_count: state === "empty" ? 0 : null,
    latest_event_at: null,
  });
};

beforeEach(() => {
  runtime = new Runtime();
  input = fixture<Onboarding>("onboarding.json");
});
afterEach(() => runtime.cleanup());

describe("onboarding supplied evidence is not independent health verification", () => {
  it("reports ready only for the declared signals, explicitly qualified by its basis", () => {
    expect(assess()).toMatchObject({
      readiness: "ready", basis: "supplied-observations-not-independent-verification",
    });
    const result = cli("validate", input.mapping);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ valid: true, cloud_access_verified: false });
  });

  it.each([
    ["missing", "blocked"], ["denied", "blocked"], ["failed", "blocked"],
    ["unsupported", "blocked"], ["empty", "telemetry-unverified"],
    ["partial", "telemetry-unverified"], ["throttled", "telemetry-unverified"],
    ["unverified", "telemetry-unverified"], ["stale", "telemetry-unverified"],
  ])("does not mistake %s telemetry for healthy data", (state, readiness) => {
    unavailable(input.signals[0], state);
    expect(assess()).toMatchObject({ readiness, signals: [{ effective_state: state }] });
  });

  it("retains optional gaps as limited coverage, not blocked or fully ready", () => {
    const optional = structuredClone(input.signals[0]);
    Object.assign(optional, { name: "dependencies", required: false });
    unavailable(optional, "denied");
    input.signals.push(optional);
    expect(assess().readiness).toBe("limited-coverage");
  });

  it.each(["tools", "identity", "mapping"] as const)("requires verified %s prerequisites", (key) => {
    input.prerequisites[key] = "unverified";
    expect(assess().readiness).toBe("telemetry-unverified");
    input.prerequisites[key] = "denied";
    expect(assess().readiness).toBe("blocked");
  });

  it("uses actual event freshness with inclusive boundary, not just collection time", () => {
    expect(assess("2026-10-29T12:04:00Z").readiness).toBe("ready");
    expect(assess("2026-10-29T12:04:01Z")).toMatchObject({
      readiness: "telemetry-unverified", signals: [{ effective_state: "stale" }],
    });
  });

  it("expires old observations and does not erase access blockers", () => {
    expect(assess("2026-10-29T12:10:01Z")).toMatchObject({
      readiness: "telemetry-unverified", reasons: ["assessment-expired"],
    });
    unavailable(input.signals[0], "denied");
    expect(assess("2026-10-29T12:10:01Z").readiness).toBe("blocked");
  });

  it.each(["zero-usable", "partial-complete", "outside-mapping", "duplicate-signal", "no-core"])(
    "rejects inconsistent observations: %s", (invalid) => {
      if (invalid === "zero-usable") input.signals[0].record_count = 0;
      if (invalid === "partial-complete") input.signals[0].state = "partial";
      if (invalid === "outside-mapping") input.signals[0].source_resource_id += "-other";
      if (invalid === "duplicate-signal") input.signals.push(structuredClone(input.signals[0]));
      if (invalid === "no-core") input.signals[0].required = false;
      expect(cli("assess", input).status).toBe(2);
    },
  );
});

describe("mapping validation", () => {
  it.each([true, "1", 2, null])("rejects schema version %s", (schema_version) => {
    expect(cli("validate", { ...input.mapping, schema_version }).status).toBe(2);
  });

  it.each([
    "https://portal.azure.com/#resource/synthetic", "/subscriptions/not-a-guid",
    "/subscriptions/11111111-1111-1111-1111-111111111111",
  ])("rejects non-resource-group ARM identity %s", (resource_id) => {
    input.mapping.resources[0].resource_id = resource_id;
    expect(cli("validate", input.mapping).status).toBe(2);
  });

  it("rejects credentials/query strings in resource IDs without echoing them", () => {
    input.mapping.resources[0].resource_id += "?token=never-echo";
    const result = cli("validate", input.mapping);
    expect(result.status).toBe(2);
    expect(result.stderr).not.toContain("never-echo");
  });

  it("rejects mismatched telemetry kind and case-insensitive duplicate resource IDs", () => {
    input.mapping.telemetry_sources[0].kind = "azure-monitor-workspace";
    expect(cli("validate", input.mapping).status).toBe(2);
    input.mapping.telemetry_sources[0].kind = "application-insights";
    input.mapping.resources.push({
      ...input.mapping.resources[0],
      resource_id: input.mapping.resources[0].resource_id.toUpperCase(),
    });
    expect(cli("validate", input.mapping).status).toBe(2);
  });

  it.each(["", "label with spaces", "x".repeat(65)])("rejects invalid labels %#", (application) => {
    expect(cli("validate", { ...input.mapping, application }).status).toBe(2);
  });

  it.each([
    '{"secret":"never-echo",}', '{"token":1,"token":2}', '{"value":NaN}',
    '{"value":Infinity}', " ".repeat(128 * 1024 + 1), Buffer.from([0xff]),
  ])("rejects malformed, duplicate, nonfinite, oversized or non-UTF-8 input %#", (value) => {
    const result = runtime.run(skill, "onboarding.py", ["validate", runtime.file(value)]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("never-echo");
  });
});

describe("local mapping persistence boundaries", () => {
  it("requires consent before any directory creation", () => {
    expect(save().status).toBe(2);
    expect(existsSync(join(runtime.root, ".obs"))).toBe(false);
  });

  it("requires a Git repo and an approved ignored destination", () => {
    expect(save("--consent").status).toBe(2);
    prepare(false);
    expect(save("--consent").status).toBe(2);
    expect(existsSync(join(runtime.root, ".obs"))).toBe(false);
    expect(existsSync(join(runtime.root, ".gitignore"))).toBe(false);
  });

  it("saves atomically, refuses overwrite, replaces only explicitly, and requires live revalidation", () => {
    prepare();
    const result = save("--consent");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ saved: true, cloud_access_verified: false });
    const destination = join(runtime.root, ".obs", "application.json");
    const original = readFileSync(destination, "utf8");
    input.mapping.environment = "staging";
    expect(save("--consent").status).toBe(2);
    expect(readFileSync(destination, "utf8")).toBe(original);
    expect(save("--consent", "--replace").status).toBe(0);
    expect(JSON.parse(readFileSync(destination, "utf8"))).toEqual(input.mapping);
    expect(readdirSync(join(runtime.root, ".obs"))).toEqual(["application.json"]);
    const loaded = runtime.run(skill, "onboarding.py", ["load", "--project", runtime.root]);
    expect(loaded.status).toBe(0);
    expect(JSON.parse(loaded.stdout)).toEqual({
      mapping: input.mapping, requires_live_revalidation: true,
    });
  });

  it("never overwrites a tracked mapping, even with replace consent", () => {
    prepare();
    expect(save("--consent").status).toBe(0);
    runtime.git("add", "--force", ".obs/application.json");
    const path = join(runtime.root, ".obs", "application.json");
    const original = readFileSync(path, "utf8");
    input.mapping.environment = "staging";
    expect(save("--consent", "--replace").status).toBe(2);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("rejects a redirected destination without touching its contents", () => {
    prepare();
    const outside = join(runtime.root, "outside");
    mkdirSync(outside);
    // Junctions need no Windows symlink privilege; symlinks are portable elsewhere.
    symlinkSync(outside, join(runtime.root, ".obs"), process.platform === "win32" ? "junction" : "dir");
    expect(save("--consent", "--replace").status).toBe(2);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("does not silently accept a corrupt saved mapping", () => {
    mkdirSync(join(runtime.root, ".obs"));
    writeFileSync(join(runtime.root, ".obs", "application.json"), "{");
    const result = runtime.run(skill, "onboarding.py", ["load", "--project", runtime.root]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
  });
});
