import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { type SkillRef } from "./utils/skill-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CompareInput = {
    /**
     * The stimuli to run.
     */
    stimuliName: string;

    /**
     * The skill the stimuli is for.
     */
    skill: SkillRef;

    /**
     * The branch to run the tests on.
     */
    branch?: string;

    /**
     * Environmental variations.
     * If undefined, a hardcoded {@link defaultCompareOptions} will be used.
     */
    compareOptions?: CompareOption[];
};

type CompareOption = {
    /**
     * The base model to run the stimuli with.
     * The base model may run subagents with different models and unfortunately that's beyond our control.
     */
    model: string;

    /**
     * Whether to load the skill.
     */
    withSkill: boolean;
};

const defaultCompareOptions: CompareOption[] = [
    // Anthropic
    // { model: "claude-sonnet-5" },
    // { model: "claude-opus-4.8" },
    // { model: "claude-sonnet-4.6", withSkill: true },
    // { model: "claude-sonnet-4.6", withSkill: false },
    // { model: "claude-opus-4.6" },
    // OpenAI
    // { model: "gpt-5.6-sol" },
    { model: "gpt-5.6-terra", withSkill: true },
    { model: "gpt-5.6-terra", withSkill: false },
    // // Google
    // { model: "gemini-3.1-pro-preview" },
];

const repo = "microsoft/GitHub-Copilot-for-Azure";
// Id of the "Integration Tests - all" workflow
const integrationTestWorkflowId = "233698760";

async function queueComparisonRun(branch: string, skill: SkillRef, option: CompareOption): Promise<string> {
    const skillsInput = `${skill.pluginDirname}/${skill.name}`;
    const args = ["workflow", "run", integrationTestWorkflowId, "--repo", repo, "--ref", branch, "--json"];
    const inputs = JSON.stringify({
        skills: skillsInput,
        "model-override": option.model,
    });

    return await new Promise((resolve, reject) => {
        const child = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => { stdout += chunk; });
        child.stderr.on("data", (chunk: string) => { stderr += chunk; });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `gh workflow run exited with code ${code}`));
                return;
            }

            resolve(stdout.trim());
        });

        child.stdin.end(inputs);
    });
}

function readCompareInput(filePath: string): CompareInput {
    const input = JSON.parse(readFileSync(filePath, "utf8")) as CompareInput;

    if (!input.stimuliName || !input.skill) {
        throw new Error("The input JSON must contain stimuliName and skill.");
    }

    return input;
}

/**
 * Run a matrix of comparison runs.
 * Each comparison test will feature one variation of environment, such as the model and whether skills are included.
 * Each comparison test run will be scheduled to run in GitHub Actions and persist its artifacts in the manual-integration-reports blob container.
 * An output file will be written to map each comparison test to its scheduled run for locating its published artifacts.
 */
async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        throw new Error("Usage: npm run compare -- <input.json>");
    }

    const input = readCompareInput(inputPath);
    const options = input.compareOptions ?? defaultCompareOptions;
    const results = [];
    const branch = input.branch ?? "main";
    const skill = input.skill;
    for (const option of options) {
        // Each output is a url to the queued run
        // e.g. https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/31218229738
        const output = await queueComparisonRun(branch, skill, option);
        const entry = {
            model: option.model,
            withSkill: option.withSkill,
            run: output
        };
        results.push(entry);
    }
    const output = {
        stimuliName: input.stimuliName,
        skill: input.skill,
        date: new Date().toISOString().slice(0, 10), // Get yyyy-mm-dd date string
        runs: results
    };
    const outputFilename = `comparison-runs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(path.resolve(__dirname, outputFilename), JSON.stringify(output, null, 2));
}

main();