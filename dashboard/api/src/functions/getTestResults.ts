import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { enumerateBlobs, getBlobContent, BlobTree, BlobTreeNode } from "../blobEnumerator";
import { logRequestIdentity } from "../requestIdentity";
import { SKILL_REPORT_PATTERN } from "../skillReport";

const TEST_RESULTS_FILENAME = "testResults.json";
const TOKEN_SUMMARY_FILENAME = "token-summary.jsonl";

/** A single record from a token-summary.jsonl file */
interface TokenSummaryRecord {
    testName: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
}

/** Aggregated token usage for one non-skill-invocation test */
export interface TestTokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    /** inputTokens + outputTokens */
    totalTokens: number;
    /** Number of agent runs contributing to these totals */
    runCount: number;
}

/** Shape of a single test case entry inside testResults.json */
interface TestCaseResult {
    isPass: boolean;
    message?: string;
    skillInvocationRate?: number;
}

/** The raw testResults.json file: test-name → result */
type RawTestResults = Record<string, TestCaseResult>;

interface TestCase {
    testName: string;
    message?: string;
    skillInvocationRate?: number;
}

export interface SkillStats {
    skillInvocationTestsPassed: number;
    skillInvocationTestsFailed: number;
    averageSkillInvocationRate: number | null;
    worstSkillInvocationRate: number | null;
    otherTestsPassed: number;
    otherTestsFailed: number;
    failedTests: TestCase[];
    passedTests: TestCase[];
    /** Average Confidence extracted from SKILL-REPORT.md files (0–100), or null if not available. */
    averageConfidence: number | null;
    /**
     * Maps sanitised test-case directory names to the number of deployment retries
     * recorded for that test case within a single agent run.
     * A retry is counted each time a deploy command (azd up, azd deploy, terraform apply)
     * is invoked after the first attempt within the same agent session.
     * Populated only for the azure-deploy skill; skill-invocation tests are excluded.
     */
    scenarioDeployRetryCounts?: Record<string, number>;
    /**
     * Total token usage per non-skill-invocation test, keyed by sanitised test name.
     * Summed across all agent runs for the selected date.
     */
    tokenUsageByTest?: Record<string, TestTokenUsage>;
}

export type SkillTestResults = Record<string, SkillStats>;

/**
 * Recursively collect all testResults.json blob paths from a tree node,
 * tracking the skill name from the path hierarchy.
 */
function collectTestResultPaths(
    node: BlobTreeNode,
    skillName: string,
    results: Map<string, string[]>,
): void {
    for (const file of node.files) {
        if (file.name === TEST_RESULTS_FILENAME) {
            if (!results.has(skillName)) {
                results.set(skillName, []);
            }
            results.get(skillName)!.push(file.blobName);
        }
    }
    for (const child of Object.values(node.children)) {
        collectTestResultPaths(child, skillName, results);
    }
}

/**
 * Sanitize a test name the same way agent-runner.ts does when naming directories.
 * Used to match token-summary.jsonl entries (which contain the sanitised name)
 * against skill-invocation test entries (which use the raw Jest name).
 */
function sanitizeTestName(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, "-")
        .replace(/\s+/g, "_")
        .replace(/-+/g, "-")
        .replace(/_+/g, "_")
        .substring(0, 200);
}

/**
 * Collect token-summary.jsonl blob paths for a skill.
 * The file lives at the skill level for most skills and at the test-group level
 * for azure-deploy (which uses an extra directory tier).
 */
function collectTokenSummaryPaths(
    skillNode: BlobTreeNode,
    skillName: string,
    results: Map<string, string[]>,
): void {
    for (const file of skillNode.files) {
        if (file.name === TOKEN_SUMMARY_FILENAME) {
            if (!results.has(skillName)) results.set(skillName, []);
            results.get(skillName)!.push(file.blobName);
        }
    }
    for (const child of Object.values(skillNode.children)) {
        for (const file of child.files) {
            if (file.name === TOKEN_SUMMARY_FILENAME) {
                if (!results.has(skillName)) results.set(skillName, []);
                results.get(skillName)!.push(file.blobName);
            }
        }
    }
}

/**
 * Parse a token-summary.jsonl string into individual token records.
 */
function parseTokenSummaryJsonl(raw: string): TokenSummaryRecord[] {
    const records: TokenSummaryRecord[] = [];
    for (const line of raw.trim().split("\n")) {
        if (!line.trim()) continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed && typeof parsed.testName === "string") {
                records.push(parsed as TokenSummaryRecord);
            }
        } catch {
            // skip invalid lines
        }
    }
    return records;
}

/**
 * Recursively collect all SKILL-REPORT.md blob paths from a tree node.
 */
function collectSkillReportPaths(
    node: BlobTreeNode,
    skillName: string,
    results: Map<string, string[]>,
): void {
    for (const file of node.files) {
        if (SKILL_REPORT_PATTERN.test(file.name)) {
            if (!results.has(skillName)) {
                results.set(skillName, []);
            }
            results.get(skillName)!.push(file.blobName);
        }
    }
    for (const child of Object.values(node.children)) {
        collectSkillReportPaths(child, skillName, results);
    }
}

const AGENT_METADATA_JSON = "agent-metadata.json";

/**
 * Regex matching deploy commands that constitute a deployment attempt:
 * azd up, azd deploy, terraform apply.
 */
const DEPLOY_COMMAND_PATTERN = /\bazd\s+(?:up|deploy)\b|\bterraform\s+apply\b/i;

/**
 * Collect agent-metadata.json blob paths for each scenario test case directory
 * under the given skill node.
 *
 * The agent-metadata.json file is excluded from blob enumeration, so its path
 * is derived from any other file present in the same directory.
 *
 * The "skill-invocation" group is excluded.
 *
 * @param skillNode  BlobTreeNode for the skill (e.g. azure-deploy)
 * @param results    Accumulates testCaseDirName → list of agent-metadata.json blob paths
 */
function collectAgentMetadataPaths(
    skillNode: BlobTreeNode,
    results: Map<string, string[]>,
): void {
    for (const [groupName, groupNode] of Object.entries(skillNode.children)) {
        if (groupName === "skill-invocation") continue;

        // Level 2: test-case directories under a test-group directory
        for (const [testCaseName, testCaseNode] of Object.entries(groupNode.children)) {
            // Derive the agent-metadata.json path from any sibling file in the directory
            const anchor = testCaseNode.files[0];
            if (!anchor) continue;
            const jsonPath = anchor.blobName.replace(/\/[^/]+$/, `/${AGENT_METADATA_JSON}`);
            if (!results.has(testCaseName)) {
                results.set(testCaseName, []);
            }
            results.get(testCaseName)!.push(jsonPath);
        }
    }
}

/**
 * Parse an agent-metadata.json string and count deployment retries.
 *
 * A retry is any deploy command invocation after the first within the session.
 * Counts tool.execution_start events for powershell/bash tools whose command
 * matches azd up, azd deploy, or terraform apply.
 *
 * Returns null when the input cannot be parsed or contains no events array,
 * so callers can distinguish invalid/unreadable files from a genuine 0-retry run.
 * @returns max(0, deployInvocations - 1), or null for invalid input
 */
function countDeployRetries(raw: string): number | null {
    let parsed: { events?: Array<{ type: string; data?: { toolName?: string; arguments?: { command?: string } } }> };
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!Array.isArray(parsed.events)) return null;

    let deployCount = 0;
    for (const event of parsed.events) {
        if (event.type !== "tool.execution_start") continue;
        const toolName = event.data?.toolName;
        if (toolName !== "powershell" && toolName !== "bash") continue;
        const command = event.data?.arguments?.command ?? "";
        if (DEPLOY_COMMAND_PATTERN.test(command)) {
            deployCount++;
        }
    }
    return Math.max(0, deployCount - 1);
}

/**
 * Extract the Average Confidence percentage from a SKILL-REPORT markdown string.
 * Looks for an `Average Confidence` markdown table row, tolerating case differences,
 * optional bolding, and extra whitespace, for example:
 * | **Average Confidence** | **{value}%** |
 * | Average confidence | {value}% |
 * Returns a number 0–100, or null if not found.
 */
function extractAverageConfidence(markdown: string): number | null {
    const match = markdown.match(/^\s*\|\s*(?:\*\*)?\s*Average Confidence\s*(?:\*\*)?\s*\|\s*(?:\*\*)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:\*\*)?\s*\|\s*$/im);
    if (!match) return null;
    const value = parseFloat(match[1]);
    return isNaN(value) ? null : value;
}

function computeSkillStats(allResults: RawTestResults[]): SkillStats {
    let siPassed = 0;
    let siFailed = 0;
    let siRateSum = 0;
    let siCount = 0;
    let worstRate: number | null = null;
    let otherPassed = 0;
    let otherFailed = 0;
    const failedTests: TestCase[] = [];
    const passedTests: TestCase[] = [];

    for (const results of allResults) {
        for (const [testName, tc] of Object.entries(results)) {
            const isSkillInvocation = tc.skillInvocationRate !== undefined;
            if (isSkillInvocation) {
                if (tc.isPass) {
                    siPassed++;
                } else {
                    siFailed++;
                }
                siRateSum += tc.skillInvocationRate!;
                siCount++;
                if (worstRate === null || tc.skillInvocationRate! < worstRate) {
                    worstRate = tc.skillInvocationRate!;
                }
            } else {
                if (tc.isPass) {
                    otherPassed++;
                } else {
                    otherFailed++;
                }
            }

            if (!tc.isPass) {
                failedTests.push({
                    testName,
                    message: tc.message,
                    skillInvocationRate: tc.skillInvocationRate,
                });
            } else {
                passedTests.push({
                    testName,
                    message: tc.message,
                    skillInvocationRate: tc.skillInvocationRate,
                });
            }
        }
    }

    return {
        skillInvocationTestsPassed: siPassed,
        skillInvocationTestsFailed: siFailed,
        averageSkillInvocationRate: siCount > 0 ? siRateSum / siCount : null,
        worstSkillInvocationRate: worstRate,
        otherTestsPassed: otherPassed,
        otherTestsFailed: otherFailed,
        failedTests,
        passedTests,
        averageConfidence: null,
    };
}

/**
 * Returns computed test statistics for a given date, organized by skill name.
 * GET /api/test-results/{date}
 */
async function getTestResults(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getTestResults");

    const date = request.params.date;
    if (!date) {
        return { status: 400, body: "Missing date parameter" };
    }

    const tree: BlobTree = await enumerateBlobs(`${date}/`);
    const dateNode = tree[date];
    if (!dateNode) {
        return { status: 404, body: `No data found for date: ${date}` };
    }

    // Collect testResults.json paths organized by skill name.
    // Structure: date -> runId -> skillName -> (files | children with testResults.json)
    const pathsBySkill = new Map<string, string[]>();
    const reportPathsBySkill = new Map<string, string[]>();
    const tokenSummaryPathsBySkill = new Map<string, string[]>();
    // Collect agent-metadata.json paths for deploy scenario retry counting
    const agentMetadataPathsByTestCase = new Map<string, string[]>();

    for (const runNode of Object.values(dateNode.children)) {
        for (const [skillName, skillNode] of Object.entries(runNode.children)) {
            collectTestResultPaths(skillNode, skillName, pathsBySkill);
            collectSkillReportPaths(skillNode, skillName, reportPathsBySkill);
            collectTokenSummaryPaths(skillNode, skillName, tokenSummaryPathsBySkill);

            if (skillName === "azure-deploy") {
                collectAgentMetadataPaths(skillNode, agentMetadataPathsByTestCase);
            }
        }
    }

    // Fetch all testResults.json contents in parallel, grouped by skill
    const rawBySkill = new Map<string, RawTestResults[]>();

    const fetchTasks: Promise<void>[] = [];
    for (const [skillName, paths] of pathsBySkill) {
        rawBySkill.set(skillName, []);
        for (const blobPath of paths.sort()) {
            fetchTasks.push(
                getBlobContent(blobPath).then((raw) => {
                    try {
                        const parsed: RawTestResults = JSON.parse(raw);
                        rawBySkill.get(skillName)!.push(parsed);
                    } catch {
                        // Skip unparseable files
                    }
                }),
            );
        }
    }

    await Promise.all(fetchTasks);

    // Fetch SKILL-REPORT.md files and extract Average Confidence per skill
    const confidenceBySkill = new Map<string, number[]>();
    const reportFetchTasks: Promise<void>[] = [];
    for (const [skillName, paths] of reportPathsBySkill) {
        confidenceBySkill.set(skillName, []);
        for (const blobPath of paths) {
            reportFetchTasks.push(
                getBlobContent(blobPath).then((raw) => {
                    const conf = extractAverageConfidence(raw);
                    if (conf !== null) {
                        confidenceBySkill.get(skillName)!.push(conf);
                    }
                }).catch(() => { /* skip unreadable files */ }),
            );
        }
    }
    await Promise.all(reportFetchTasks);

    // Fetch agent-metadata.json files for azure-deploy scenario retry counts
    const deployRetryTotals = new Map<string, number>();
    const deployRetryRunCounts = new Map<string, number>();
    const retryFetchTasks: Promise<void>[] = [];
    for (const [testCaseName, paths] of agentMetadataPathsByTestCase) {
        for (const blobPath of paths) {
            retryFetchTasks.push(
                getBlobContent(blobPath).then((raw) => {
                    const retries = countDeployRetries(raw);
                    if (retries === null) return; // invalid/unreadable — don't skew the average
                    deployRetryTotals.set(
                        testCaseName,
                        (deployRetryTotals.get(testCaseName) ?? 0) + retries,
                    );
                    deployRetryRunCounts.set(
                        testCaseName,
                        (deployRetryRunCounts.get(testCaseName) ?? 0) + 1,
                    );
                }).catch(() => { /* skip unreadable files */ }),
            );
        }
    }
    await Promise.all(retryFetchTasks);

    // Average retries per run to avoid inflating counts when a scenario fires across multiple runs
    const deployRetryCounts = new Map<string, number>();
    for (const [testCaseName, total] of deployRetryTotals) {
        const runCount = deployRetryRunCounts.get(testCaseName) ?? 1;
        deployRetryCounts.set(testCaseName, total / runCount);
    }

    // Fetch token-summary.jsonl files and parse them per skill
    const tokenRecordsBySkill = new Map<string, TokenSummaryRecord[]>();
    const tokenFetchTasks: Promise<void>[] = [];
    for (const [skillName, paths] of tokenSummaryPathsBySkill) {
        tokenRecordsBySkill.set(skillName, []);
        for (const blobPath of paths) {
            tokenFetchTasks.push(
                getBlobContent(blobPath).then((raw) => {
                    const records = parseTokenSummaryJsonl(raw);
                    tokenRecordsBySkill.get(skillName)!.push(...records);
                }).catch(() => { /* skip unreadable files */ }),
            );
        }
    }
    await Promise.all(tokenFetchTasks);

    // Compute statistics per skill
    const skillTestResults: SkillTestResults = {};
    for (const [skillName, results] of rawBySkill) {
        const stats = computeSkillStats(results);
        const confValues = confidenceBySkill.get(skillName);
        if (confValues && confValues.length > 0) {
            stats.averageConfidence = confValues.reduce((a, b) => a + b, 0) / confValues.length;
        }
        if (skillName === "azure-deploy" && deployRetryCounts.size > 0) {
            stats.scenarioDeployRetryCounts = Object.fromEntries(deployRetryCounts);
        }

        // Build token usage table, excluding skill-invocation tests
        const tokenRecords = tokenRecordsBySkill.get(skillName);
        if (tokenRecords && tokenRecords.length > 0) {
            // Collect sanitised names of skill-invocation tests so we can exclude them
            const siTestNames = new Set<string>(
                [...stats.passedTests, ...stats.failedTests]
                    .filter((t) => t.skillInvocationRate !== undefined)
                    .map((t) => sanitizeTestName(t.testName)),
            );

            const tokenUsageByTest: Record<string, TestTokenUsage> = {};
            for (const record of tokenRecords) {
                if (siTestNames.has(record.testName)) continue;
                const existing = tokenUsageByTest[record.testName];
                if (existing) {
                    existing.inputTokens += record.inputTokens ?? 0;
                    existing.outputTokens += record.outputTokens ?? 0;
                    existing.cacheReadTokens += record.cacheReadTokens ?? 0;
                    existing.cacheWriteTokens += record.cacheWriteTokens ?? 0;
                    existing.totalTokens += (record.inputTokens ?? 0) + (record.outputTokens ?? 0);
                    existing.runCount++;
                } else {
                    const inp = record.inputTokens ?? 0;
                    const out = record.outputTokens ?? 0;
                    tokenUsageByTest[record.testName] = {
                        inputTokens: inp,
                        outputTokens: out,
                        cacheReadTokens: record.cacheReadTokens ?? 0,
                        cacheWriteTokens: record.cacheWriteTokens ?? 0,
                        totalTokens: inp + out,
                        runCount: 1,
                    };
                }
            }
            if (Object.keys(tokenUsageByTest).length > 0) {
                stats.tokenUsageByTest = tokenUsageByTest;
            }
        }

        skillTestResults[skillName] = stats;
    }

    return {
        status: 200,
        jsonBody: skillTestResults,
    };
}

app.http("getTestResults", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "test-results/{date}",
    handler: getTestResults,
});
