import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const directory = fileURLToPath(new URL(".", import.meta.url));

export function filesUnder(root: string, suffix: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? filesUnder(join(root, entry.name), suffix)
      : entry.name.endsWith(suffix) ? [join(root, entry.name)] : [])
    .sort();
}

interface CaseFile {
  cases?: Record<string, unknown>[];
  [key: string]: unknown;
}
interface EvalFile {
  tags: { skill: string };
  stimuli: { name: string; prompt: string; rubric: string[] }[];
}
const link = (path: string): string => relative(directory, path).replaceAll("\\", "/");
const quote = (text: string): string => text.split("\n").map((line) => `> ${line}`).join("\n");
const json = (value: unknown): string => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

/** Reproducible, complete shareable inventory; no service access or model execution. */
export function buildPromptInventory(): string {
  const fixtures = filesUnder(join(directory, "fixtures"), ".json")
    .map((path) => ({ path, value: JSON.parse(readFileSync(path, "utf8")) as CaseFile }))
    .filter(({ value }) => Array.isArray(value.cases));
  const hostDocuments = [
    join(directory, "journey-evaluation.md"),
    ...filesUnder(join(directory, "host-acceptance"), ".md"),
    ...filesUnder(join(directory, "fixtures/runtime-source"), ".md")
      .filter((path) => /(?:integration-)?host-tests\.md$/.test(path)),
  ];
  const suites = filesUnder(resolve(directory, "../../evals/azure-observability-skills"), ".yaml");
  const caseCount = fixtures.reduce((sum, { value }) => sum + (value.cases?.length ?? 0), 0);
  const sections = [
    "# Complete observability contributor prompt inventory",
    "",
    "Offline specifications only — **not executed model/host results**, not live Azure evidence,",
    "and not a statement that these prompts were shared externally.",
    "This self-contained artifact is suitable for contributor review with the azure-skills team.",
    "",
    `Includes all ${caseCount} preserved JSON cases, complete host-acceptance/journey documents,`,
    "runtime host-test notices, and the current four-skill Vally prompts and outcome rubrics.",
    "Repeated runtime shared copies were identical and are represented once by the coordinator copy.",
    "Cases without a fixed prompt retain their complete evidence and expected-outcome specification.",
    "",
    "## Review and approval boundaries",
    "",
    "- Default rehearsal ceiling: supplied synthetic evidence and local instruction reads only.",
    "- Fixture context never grants Azure/network access, authentication, installation, script execution,",
    "  edits, persistence, publication, service delegation, jobs, traffic or deployment.",
    "- Review each case's expected and forbidden outcomes separately, including evidence freshness,",
    "  selected finding, one operative question, and distinct plan/edit/publish/deploy approvals.",
    "- A missing/denied/partial/stale source is not healthy; a successful deployment/evaluation",
    "  does not prove recovery; sufficient required failure cannot be hidden by another gap.",
    "- VS Code and Copilot CLI installed-host acceptance remain UNRUN. Record observed loads,",
    "  tool attempts and consent outcomes per host; labels in responses are not load evidence.",
    "- Historical fixtures/docs below retain their exact prompts (including explicit skill requests).",
    "  References to six bundled entries, a bundled diagnostics/Foundry specialist, old paths,",
    "  Python unittest/tokenizer checks or exact presentation are historical, not current requirements.",
    "  The current plugin has only assess-observability-health, connect-observability,",
    "  troubleshoot-observability and verify-observability-fix. azure-skills specialists are optional",
    "  external dependencies. Review old expected loads as external-availability/fallback boundaries.",
    "- Current bounded evaluation scenarios are in the final section. Static lint and helper tests",
    "  cannot certify routing, natural-language compliance, portal navigation or real approval enforcement.",
    "",
    "Regenerate from the repository root with:",
    "`node --import ./tests/node_modules/tsx/dist/loader.mjs tests/azure-observability-skills/prompt-inventory.ts --write`.",
    "",
    "## Preserved JSON case specifications",
  ];
  for (const { path, value } of fixtures) {
    const { cases, ...metadata } = value;
    sections.push("", `### ${link(path)}`, "", `Source: [JSON](${link(path)}).`, "", json(metadata));
    for (const [index, entry] of (cases ?? []).entries()) {
      const { prompt, ...details } = entry;
      sections.push("", `#### ${String(entry.id ?? `case-${index + 1}`)}`, "");
      if (typeof prompt === "string") {
        sections.push(quote(prompt), "");
      } else {
        sections.push("Evidence/interaction specification; no fixed top-level user prompt.", "");
      }
      sections.push("Context, evidence, expectations and approval/operation boundaries:", "", json(details));
    }
  }
  sections.push("", "## Complete historical host/journey specifications", "",
    "The following documents are preserved verbatim for prompt completeness. Links within the",
    "archived text are historical; use the JSON sections above and the source path headings.",
    "Historical execution/setup suggestions are not authorization and were not performed.");
  for (const path of hostDocuments) {
    sections.push("", `### ${link(path)}`, "", "````markdown", readFileSync(path, "utf8").trimEnd(), "````");
  }
  sections.push("", "## Current bounded Vally scenarios", "",
    "These are executable specifications with explicit scoring, invocation, outcome and no-operation",
    "graders. They have not been run against a model merely by generating this inventory.");
  for (const path of suites) {
    const suite = parse(readFileSync(path, "utf8")) as EvalFile;
    sections.push("", `### ${suite.tags.skill}`, "", `Source: [YAML](${link(path)}).`);
    for (const stimulus of suite.stimuli) {
      sections.push("", `#### ${stimulus.name}`, "", quote(stimulus.prompt.trimEnd()), "",
        "Expected outcomes:", "", ...stimulus.rubric.map((criterion) => `- ${criterion}`));
    }
  }
  return `${sections.join("\n")}\n`;
}

if (process.argv.includes("--write")) {
  writeFileSync(join(directory, "prompt-inventory.md"), buildPromptInventory(), "utf8");
}
