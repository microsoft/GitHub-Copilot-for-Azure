import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { logRequestIdentity } from "../requestIdentity";

const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
const TOOL_USAGE_TABLE_NAME = process.env.TOOL_USAGE_TABLE_NAME;

function getToolUsageTableClient(): TableClient {
    if (!STORAGE_ACCOUNT_NAME) {
        throw new Error("STORAGE_ACCOUNT_NAME environment variable is not set");
    }
    if (!TOOL_USAGE_TABLE_NAME) {
        throw new Error("TOOL_USAGE_TABLE_NAME environment variable is not set");
    }
    const clientId = process.env.AZURE_CLIENT_ID;
    const isDevEnvironment = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
    const credential = isDevEnvironment ? new AzureCliCredential() : new ManagedIdentityCredential(clientId!);
    return new TableClient(
        `https://${STORAGE_ACCOUNT_NAME}.table.core.windows.net`,
        TOOL_USAGE_TABLE_NAME,
        credential
    );
}

/** Escape a value for use inside an OData string literal (single quotes are doubled). */
function odataLiteral(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Build the OData filter for tool-usage queries from optional equality filters.
 * Returns undefined when no filters are provided.
 */
export function buildToolUsageFilter(filters: {
    skill?: string;
    test?: string;
    branch?: string;
    runId?: string;
    runToken?: string;
    runDate?: string;
}): string | undefined {
    const clauses: string[] = [];
    if (filters.skill) clauses.push(`skill eq '${odataLiteral(filters.skill)}'`);
    if (filters.test) clauses.push(`testName eq '${odataLiteral(filters.test)}'`);
    if (filters.branch) clauses.push(`branch eq '${odataLiteral(filters.branch)}'`);
    if (filters.runId) clauses.push(`runId eq '${odataLiteral(filters.runId)}'`);
    if (filters.runToken) clauses.push(`runToken eq '${odataLiteral(filters.runToken)}'`);
    if (filters.runDate) clauses.push(`runDate eq '${odataLiteral(filters.runDate)}'`);
    return clauses.length > 0 ? clauses.join(" and ") : undefined;
}

/**
 * Returns integration-test tool usage rows from the table.
 * GET /api/tool-usage
 * Query params: skill (optional), test (optional), branch (optional),
 *               runId (optional), runToken (optional), runDate (optional)
 *
 * Each row represents a single tool call in one run. Full tool arguments are not
 * stored here — they live in the per-run blob and are fetched on demand.
 */
async function getToolUsage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getToolUsage");

    const filter = buildToolUsageFilter({
        skill: request.query.get("skill") || undefined,
        test: request.query.get("test") || undefined,
        branch: request.query.get("branch") || undefined,
        runId: request.query.get("runId") || undefined,
        runToken: request.query.get("runToken") || undefined,
        runDate: request.query.get("runDate") || undefined,
    });

    // Require at least one filter. An unfiltered scan of the one-row-per-tool-call
    // table can be very large and risks timeouts / excessive storage reads.
    if (!filter) {
        return {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                error: "At least one filter is required: skill, test, branch, runId, runToken, or runDate.",
            }),
        };
    }

    try {
        const tableClient = getToolUsageTableClient();
        const listOptions = { queryOptions: { filter } };
        const entities: Record<string, unknown>[] = [];

        for await (const entity of tableClient.listEntities(listOptions)) {
            entities.push({
                skill: entity.skill,
                testName: entity.testName,
                branch: entity.branch,
                runId: entity.runId,
                runDate: entity.runDate,
                runTimestamp: entity.runTimestamp,
                runToken: entity.runToken,
                reportFile: entity.reportFile,
                sessionId: entity.sessionId,
                model: entity.model,
                order: entity.order,
                toolName: entity.toolName,
                toolCallId: entity.toolCallId,
                successState: entity.successState,
                durationMs: entity.durationMs,
                outputBytes: entity.outputBytes,
            });
        }

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entities),
        };
    } catch (err: any) {
        context.error("Error querying tool usage:", err?.message ?? err);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Failed to query tool usage" }),
        };
    }
}

app.http("getToolUsage", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "tool-usage",
    handler: getToolUsage,
});
