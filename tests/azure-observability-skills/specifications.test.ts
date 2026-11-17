import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { buildPromptInventory, filesUnder } from "./prompt-inventory";

const directory = fileURLToPath(new URL(".", import.meta.url));
const skills = [
  "assess-observability-health", "connect-observability",
  "troubleshoot-observability", "verify-observability-fix",
];
interface Suite {
  tags: { skill: string; type: string };
  scoring: { threshold: number };
  defaults: { executor: string };
  stimuli: {
    name: string; prompt: string; rubric: string[];
    tags: { type: string; tier: string; cost: string; area: string };
    graders: { type: string }[];
  }[];
}

describe("contributor inventory and offline eval metadata", () => {
  it("keeps the complete shareable artifact synchronized with preserved sources", () => {
    expect(readFileSync(resolve(directory, "prompt-inventory.md"), "utf8")).toBe(buildPromptInventory());
  });

  it("preserves unique case IDs and reviewable outcomes in every case fixture", () => {
    const sources = filesUnder(resolve(directory, "fixtures"), ".json")
      .map((path) => JSON.parse(readFileSync(path, "utf8")) as { cases?: Record<string, unknown>[] })
      .filter((value) => Array.isArray(value.cases));
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      const cases = source.cases ?? [];
      expect(cases.length).toBeGreaterThan(0);
      expect(new Set(cases.map((entry) => entry.id)).size).toBe(cases.length);
      for (const entry of cases) {
        expect(typeof entry.id).toBe("string");
        expect(entry.expected ?? entry.expect ?? entry.next_action).toBeDefined();
      }
    }
  });

  it("provides exactly four suites with outcome, invocation and operation-boundary graders", () => {
    const suites = filesUnder(resolve(directory, "../../evals/azure-observability-skills"), ".yaml")
      .map((path) => parse(readFileSync(path, "utf8")) as Suite);
    expect(suites.map((suite) => suite.tags.skill).sort()).toEqual([...skills].sort());
    for (const suite of suites) {
      expect(suite.scoring.threshold).toBe(1);
      expect(suite.defaults.executor).toBe("copilot-sdk-agent-runner");
      expect(suite.stimuli.length).toBeGreaterThanOrEqual(3);
      for (const stimulus of suite.stimuli) {
        expect(stimulus.prompt.length).toBeGreaterThan(100);
        expect(stimulus.rubric.length).toBeGreaterThanOrEqual(3);
        expect(stimulus.tags).toMatchObject({
          type: "integration", tier: "full", cost: "llm", area: "response-quality",
        });
        expect(stimulus.graders.map((grader) => grader.type)).toEqual(
          expect.arrayContaining(["skill-invocation", "prompt", "completed", "tool-calls"]),
        );
      }
    }
  });
});
