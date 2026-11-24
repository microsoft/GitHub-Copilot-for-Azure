import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

test("Trace Store skills retain registration, runtime gates, and meaningful evals", () => {
  const root = new URL("../../../../", import.meta.url);
  const skillsRoot = new URL("plugins/azure-monitor-traces/skills/", root);
  const skills = readdirSync(skillsRoot).sort();
  const config = JSON.parse(readFileSync(new URL("tests/skills.json", root), "utf8"));
  const plugin = config.plugins.find((entry: { dirname: string }) => entry.dirname === "azure-monitor-traces");
  expect(plugin.skills.toSorted()).toEqual(skills);
  const scheduled = ["0 5 * * 2-6", "0 8 * * 2-6", "0 12 * * 2-6"]
    .flatMap(cron => (plugin.integrationTestSchedule[cron] ?? "").split(",").filter(Boolean));
  expect(scheduled.sort()).toEqual(skills);

  for (const skill of skills) {
    const markdown = readFileSync(new URL(`${skill}/SKILL.md`, skillsRoot), "utf8");
    expect(markdown).toContain("references/workflow.md");
    expect(markdown).toContain("Independent compare commands are unavailable");

    const suite = parse(readFileSync(new URL(`evals/azure-monitor-traces/${skill}/eval.yaml`, root), "utf8"));
    const routing = suite.stimuli.filter((stimulus: { tags: { area: string } }) => stimulus.tags.area === "routing");
    expect(routing).toHaveLength(2);
    expect(suite.stimuli).toHaveLength(3);
    for (const stimulus of routing) {
      expect(stimulus.tags.requiredSkills).toContain(skill);
      expect(stimulus.graders).toContainEqual({ type: "skill-invocation", config: { required: [skill] } });
      expect(JSON.stringify(stimulus)).not.toContain(`Invoke ${skill} skill and describe`);
    }

    const referencesRoot = new URL(`${skill}/references/`, skillsRoot);
    const references = readdirSync(referencesRoot);
    const allMarkdown = [markdown, ...references.map(file =>
      readFileSync(new URL(file, referencesRoot), "utf8"))].join("\n");
    expect(allMarkdown).not.toMatch(/\baz_(?:query_and_wait|derive_latency_cohorts|summarize_trace_impact|compare_\w+|build_portal_url)\b/);
    expect(allMarkdown).not.toMatch(/structuredResults|compactResults|includeTraceIds|success_rate/);
  }

  const capabilities = readFileSync(new URL("trace-investigation-contract/references/capabilities.md", skillsRoot), "utf8");
  expect(capabilities).toContain("Exact latency-cohort helper");
  expect(capabilities).toContain("Exact impact helper");
  const legacy = JSON.parse(readFileSync(new URL("plugins/azure-monitor-traces/.mcp.json", root), "utf8"));
  const portable = JSON.parse(readFileSync(new URL("plugins/azure-monitor-traces/mcp.json", root), "utf8"));
  expect(legacy.mcpServers["azure-monitor-traces"].args).toContain("@azure/mcp@latest");
  expect(portable.mcpServers["azure-monitor-traces"]).toEqual({
    type: "stdio",
    ...legacy.mcpServers["azure-monitor-traces"],
  });
});
