import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { enumerateBlobs, getBlobContent, BlobTree, BlobTreeNode } from "../blobEnumerator";

const TEST_RESULTS_FILENAME = "testResults.json";

/** Shape of a single test case entry inside testResults.json */
interface TestCaseResult {
    isPass: boolean;
    message?: string;
    skillInvocationRate?: number;
}

/** The raw testResults.json file: test-name → result */
type RawTestResults = Record<string, TestCaseResult>;

interface FailedTestCase {
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
    failedTests: FailedTestCase[];
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

function computeSkillStats(allResults: RawTestResults[]): SkillStats {
    let siPassed = 0;
    let siFailed = 0;
    let siRateSum = 0;
    let siCount = 0;
    let worstRate: number | null = null;
    let otherPassed = 0;
    let otherFailed = 0;
    const failedTests: FailedTestCase[] = [];

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
    };
}

/**
 * Returns computed test statistics for a given date, organized by skill name.
 * GET /api/test-results/{date}
 */
async function getTestResults(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    for (const runNode of Object.values(dateNode.children)) {
        for (const [skillName, skillNode] of Object.entries(runNode.children)) {
            collectTestResultPaths(skillNode, skillName, pathsBySkill);
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

    // Compute statistics per skill
    const skillTestResults: SkillTestResults = {};
    for (const [skillName, results] of rawBySkill) {
        skillTestResults[skillName] = computeSkillStats(results);
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
