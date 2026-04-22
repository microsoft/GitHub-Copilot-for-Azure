import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { logRequestIdentity } from "../requestIdentity";

const MSBENCH_STORAGE_ACCOUNT = process.env.MSBENCH_STORAGE_ACCOUNT;
const EVAL_TABLE_NAME = process.env.MSBENCH_EVAL_TABLE_NAME;

function getEvalTableClient(): TableClient {
    if (!MSBENCH_STORAGE_ACCOUNT) {
        throw new Error("MSBENCH_STORAGE_ACCOUNT environment variable is not set");
    }
    if (!EVAL_TABLE_NAME) {
        throw new Error("MSBENCH_EVAL_TABLE_NAME environment variable is not set");
    }
    const clientId = process.env.AZURE_CLIENT_ID;
    const isDevEnvironment = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
    const credential = isDevEnvironment ? new AzureCliCredential() : new ManagedIdentityCredential(clientId!);
    return new TableClient(
        `https://${MSBENCH_STORAGE_ACCOUNT}.table.core.windows.net`,
        EVAL_TABLE_NAME,
        credential
    );
}

/**
 * Returns eval metrics from the table.
 * GET /api/msbench-eval-metrics
 * Query params: benchmark (optional), model (optional)
 */
async function getMsbenchEvalMetrics(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getMsbenchEvalMetrics");

    const filterBenchmark = request.query.get("benchmark") || undefined;
    const filterModel = request.query.get("model") || undefined;
    const filterResolved = request.query.get("resolved");

    try {
        const tableClient = getEvalTableClient();

        const filters: string[] = [];
        if (filterBenchmark) filters.push(`benchmark eq '${filterBenchmark}'`);
        if (filterModel) filters.push(`model eq '${filterModel}'`);
        if (filterResolved === "1" || filterResolved === "0") filters.push(`resolved eq ${Number(filterResolved)}`);
        const filter = filters.length > 0 ? filters.join(" and ") : undefined;

        const listOptions = filter ? { queryOptions: { filter } } : {};
        const entities: Record<string, unknown>[] = [];

        for await (const entity of tableClient.listEntities(listOptions)) {
            entities.push({
                date: entity.partitionKey,
                benchmark: entity.benchmark,
                model: entity.model,
                totalConsumedTokens: entity.totalConsumedTokens,
                totalSteps: entity.totalSteps,
                resolved: entity.resolved,
            });
        }

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entities),
        };
    } catch (err: any) {
        context.log("Error querying eval metrics:", err.message);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
}

/**
 * Returns distinct benchmark and model values from the table.
 * GET /api/msbench-eval-metrics/filters
 */
async function getMsbenchEvalFilters(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "getMsbenchEvalFilters");

    try {
        const tableClient = getEvalTableClient();
        const benchmarks = new Set<string>();
        const models = new Set<string>();

        for await (const entity of tableClient.listEntities({
            queryOptions: { select: ["benchmark", "model"] },
        })) {
            if (entity.benchmark) benchmarks.add(entity.benchmark as string);
            if (entity.model) models.add(entity.model as string);
        }

        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                benchmarks: [...benchmarks].sort(),
                models: [...models].sort(),
            }),
        };
    } catch (err: any) {
        context.log("Error querying eval filters:", err.message);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
}

app.http("getMsbenchEvalMetrics", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "msbench-eval-metrics",
    handler: getMsbenchEvalMetrics,
});

app.http("getMsbenchEvalFilters", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "msbench-eval-metrics/filters",
    handler: getMsbenchEvalFilters,
});
