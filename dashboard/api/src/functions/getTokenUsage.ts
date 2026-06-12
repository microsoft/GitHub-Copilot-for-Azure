import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { logRequestIdentity } from "../requestIdentity";

const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
const TOKEN_USAGE_TABLE_NAME = process.env.TOKEN_USAGE_TABLE_NAME;

function getTokenUsageTableClient(): TableClient {
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
 * Returns integration-test token usage rows from the table.
 * GET /api/token-usage
 * Query params: skill (optional), test (optional), branch (optional)
 *
 * Each row represents one test, in one branch, for one run.
 */
async function getTokenUsage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getTokenUsage");

    const filterSkill = request.query.get("skill") || undefined;
    const filterTest = request.query.get("test") || undefined;
    const filterBranch = request.query.get("branch") || undefined;

    try {
        const tableClient = getTokenUsageTableClient();

        const filters: string[] = [];
        if (filterSkill) filters.push(`skill eq '${odataLiteral(filterSkill)}'`);
        if (filterTest) filters.push(`testName eq '${odataLiteral(filterTest)}'`);
        if (filterBranch) filters.push(`branch eq '${odataLiteral(filterBranch)}'`);
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
            });
        }

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entities),
        };
    } catch (err: any) {
        context.error("Error querying token usage:", err?.message ?? err);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Failed to query token usage" }),
        };
    }
}

/**
 * Returns distinct skill, test, and branch values from the table.
 * GET /api/token-usage/filters
 */
async function getTokenUsageFilters(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getTokenUsageFilters");

    try {
        const tableClient = getTokenUsageTableClient();
        const skills = new Set<string>();
        const tests = new Set<string>();
        const branches = new Set<string>();
        const testsBySkillSets = new Map<string, Set<string>>();

        for await (const entity of tableClient.listEntities({
            queryOptions: { select: ["skill", "testName", "branch"] },
        })) {
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
        context.error("Error querying token usage filters:", err?.message ?? err);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Failed to query token usage filters" }),
        };
    }
}

app.http("getTokenUsage", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "token-usage",
    handler: getTokenUsage,
});

app.http("getTokenUsageFilters", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "token-usage/filters",
    handler: getTokenUsageFilters,
});
