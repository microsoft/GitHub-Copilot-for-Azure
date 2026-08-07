import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { logRequestIdentity } from "../requestIdentity";
import { resolveSkillFilter } from "../blobEnumerator";

const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
const TOKEN_USAGE_TABLE_NAME = process.env.TOKEN_USAGE_TABLE_NAME;

function getTestRunMetricsTableClient(): TableClient {
    if (!STORAGE_ACCOUNT_NAME) {
        throw new Error("STORAGE_ACCOUNT_NAME environment variable is not set");
    }
    if (!TOKEN_USAGE_TABLE_NAME) {
        throw new Error("TOKEN_USAGE_TABLE_NAME environment variable is not set");
    }
    const clientId = process.env.AZURE_CLIENT_ID;
    const isDevEnvironment = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
    const credential = isDevEnvironment ? new AzureCliCredential() : new ManagedIdentityCredential(clientId!);
    return new TableClient(
        `https://${STORAGE_ACCOUNT_NAME}.table.core.windows.net`,
        TOKEN_USAGE_TABLE_NAME,
        credential
    );
}

/** Escape a value for use inside an OData string literal (single quotes are doubled). */
function odataLiteral(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Build an OData clause that matches any skill in the set, e.g.
 * `(skill eq 'a' or skill eq 'b')`. Returns undefined for an empty set.
 */
function skillSetClause(skills: Set<string>): string | undefined {
    if (skills.size === 0) {
        return undefined;
    }
    return `(${[...skills].map((s) => `skill eq '${odataLiteral(s)}'`).join(" or ")})`;
}

/**
 * Returns integration-test run metrics rows from the table.
 * GET /api/test-run-metrics
 * Query params: skill (optional), test (optional), branch (optional)
 *
 * Each row represents one test, in one branch, for one run, and carries token
 * usage plus the run's total API duration and turn (LLM round-trip) count.
 */
async function getTestRunMetrics(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getTestRunMetrics");

    const filterSkill = request.query.get("skill") || undefined;
    const filterTest = request.query.get("test") || undefined;
    const filterBranch = request.query.get("branch") || undefined;
    const filterPlugin = request.query.get("plugin") || undefined;

    try {
        const tableClient = getTestRunMetricsTableClient();

        // When a plugin is specified, restrict to its skills. An unknown plugin
        // resolves to an empty set, which means no rows can match.
        const skillFilter = await resolveSkillFilter(filterPlugin);
        if (skillFilter && skillFilter.size === 0) {
            return {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: "[]",
            };
        }

        const filters: string[] = [];
        if (filterSkill) filters.push(`skill eq '${odataLiteral(filterSkill)}'`);
        if (filterTest) filters.push(`testName eq '${odataLiteral(filterTest)}'`);
        if (filterBranch) filters.push(`branch eq '${odataLiteral(filterBranch)}'`);
        if (skillFilter) {
            const clause = skillSetClause(skillFilter);
            if (clause) filters.push(clause);
        }
        const filter = filters.length > 0 ? filters.join(" and ") : undefined;

        const listOptions = filter ? { queryOptions: { filter } } : {};
        const entities: Record<string, unknown>[] = [];

        for await (const entity of tableClient.listEntities(listOptions)) {
            entities.push({
                skill: entity.skill,
                testName: entity.testName,
                branch: entity.branch,
                runId: entity.runId,
                runDate: entity.runDate,
                runTimestamp: entity.runTimestamp,
                model: entity.model,
                inputTokens: entity.inputTokens,
                outputTokens: entity.outputTokens,
                cacheReadTokens: entity.cacheReadTokens,
                cacheWriteTokens: entity.cacheWriteTokens,
                totalTokens: entity.totalTokens,
                durationMs: entity.durationMs,
                turns: entity.turns,
            });
        }

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entities),
        };
    } catch (err: any) {
        context.error("Error querying test run metrics:", err?.message ?? err);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Failed to query test run metrics" }),
        };
    }
}

/**
 * Returns distinct skill, test, and branch values from the table.
 * GET /api/test-run-metrics/filters
 */
async function getTestRunMetricsFilters(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getTestRunMetricsFilters");

    try {
        const tableClient = getTestRunMetricsTableClient();
        // When a plugin is specified, only surface filter values for its skills.
        const skillFilter = await resolveSkillFilter(request.query.get("plugin") || undefined);
        const skills = new Set<string>();
        const tests = new Set<string>();
        const branches = new Set<string>();
        const testsBySkillSets = new Map<string, Set<string>>();

        for await (const entity of tableClient.listEntities({
            queryOptions: { select: ["skill", "testName", "branch"] },
        })) {
            if (skillFilter && (!entity.skill || !skillFilter.has(entity.skill as string))) {
                continue;
            }
            if (entity.skill) skills.add(entity.skill as string);
            if (entity.testName) tests.add(entity.testName as string);
            if (entity.branch) branches.add(entity.branch as string);
            if (entity.skill && entity.testName) {
                const skill = entity.skill as string;
                let set = testsBySkillSets.get(skill);
                if (!set) {
                    set = new Set<string>();
                    testsBySkillSets.set(skill, set);
                }
                set.add(entity.testName as string);
            }
        }

        const testsBySkill: Record<string, string[]> = {};
        for (const [skill, set] of testsBySkillSets) {
            testsBySkill[skill] = [...set].sort();
        }

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                skills: [...skills].sort(),
                tests: [...tests].sort(),
                branches: [...branches].sort(),
                testsBySkill,
            }),
        };
    } catch (err: any) {
        context.error("Error querying test run metrics filters:", err?.message ?? err);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Failed to query test run metrics filters" }),
        };
    }
}

app.http("getTestRunMetrics", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "test-run-metrics",
    handler: getTestRunMetrics,
});

app.http("getTestRunMetricsFilters", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "test-run-metrics/filters",
    handler: getTestRunMetricsFilters,
});
