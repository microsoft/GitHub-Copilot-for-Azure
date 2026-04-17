import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { listMsbenchDates, enumerateMsbenchBlobs, getMsbenchBlobContent } from "../msbenchBlobEnumerator";
import { BlobTreeNode } from "../blobEnumerator";
import { logRequestIdentity } from "../requestIdentity";

const MSBENCH_STORAGE_ACCOUNT = "msbenchnightlydata";
const EVAL_TABLE_NAME = "msbenchevalmetrics";
const EVAL_REPORT_PATTERN = /^.*_eval_report\.json$/;

interface EvalReport {
    total_consumed_tokens: number;
    total_steps: number;
    model: string;
    instance_id: string;
    resolved?: boolean;
    [key: string]: unknown;
}

function getEvalTableClient(): TableClient {
    const clientId = process.env.AZURE_CLIENT_ID;
    const isDevEnvironment = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
    const credential = isDevEnvironment ? new AzureCliCredential() : new ManagedIdentityCredential(clientId!);
    return new TableClient(
        `https://${MSBENCH_STORAGE_ACCOUNT}.table.core.windows.net`,
        EVAL_TABLE_NAME,
        credential
    );
}

function collectEvalReportPaths(node: BlobTreeNode): string[] {
    const paths: string[] = [];
    for (const file of node.files) {
        if (EVAL_REPORT_PATTERN.test(file.name)) {
            paths.push(file.blobName);
        }
    }
    for (const child of Object.values(node.children)) {
        paths.push(...collectEvalReportPaths(child));
    }
    return paths;
}

/**
 * Check which dates already have entries in the table.
 */
async function getProcessedDates(tableClient: TableClient): Promise<Set<string>> {
    const dates = new Set<string>();
    for await (const entity of tableClient.listEntities({
        queryOptions: { select: ["partitionKey"] },
    })) {
        if (entity.partitionKey) dates.add(entity.partitionKey);
    }
    return dates;
}

/**
 * Core sync logic: scan blob storage for new eval reports and upsert into table.
 * Returns { synced, dates } or { synced: 0, message } if nothing new.
 */
async function runSync(context: InvocationContext, force = false): Promise<{ synced: number; dates?: string[]; message?: string }> {
    const tableClient = getEvalTableClient();
    const blobDates = await listMsbenchDates();

    let datesToProcess: string[];
    if (force) {
        datesToProcess = blobDates;
    } else {
        const processedDates = await getProcessedDates(tableClient);
        datesToProcess = blobDates.filter((d) => !processedDates.has(d));
    }

    if (datesToProcess.length === 0) {
        return { synced: 0, message: "All dates already processed." };
    }

    let totalSynced = 0;

    await Promise.all(
        datesToProcess.map(async (date) => {
            const tree = await enumerateMsbenchBlobs(`${date}/`);
            const dateNode = tree[date];
            if (!dateNode) return;

            const evalPaths = collectEvalReportPaths(dateNode);

            const reports = await Promise.all(
                evalPaths.map(async (path) => {
                    try {
                        const raw = await getMsbenchBlobContent(path);
                        return JSON.parse(raw) as EvalReport;
                    } catch {
                        context.log(`Skipping malformed eval report: ${path}`);
                        return null;
                    }
                })
            );

            for (const report of reports) {
                if (!report) continue;
                const benchmark = report.instance_id || "unknown";
                const model = report.model || "unknown";

                await tableClient.upsertEntity({
                    partitionKey: date,
                    rowKey: `${benchmark}_${model}`,
                    benchmark,
                    model,
                    totalConsumedTokens: Number(report.total_consumed_tokens) || 0,
                    totalSteps: Number(report.total_steps) || 0,
                    resolved: report.resolved ? 1 : 0,
                });
                totalSynced++;
            }
        })
    );

    return { synced: totalSynced, dates: datesToProcess };
}

/**
 * Sync eval report data from blob storage into the table.
 * Only processes dates that don't already have entries.
 * POST /api/msbench-eval-metrics/sync
 */
async function syncMsbenchEvalMetrics(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    logRequestIdentity(request, context, "syncMsbenchEvalMetrics");

    const force = request.query.get("force") === "true";

    try {
        const result = await runSync(context, force);
        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
        };
    } catch (err: any) {
        context.log("Error syncing eval metrics:", err.message);
        return {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message }),
        };
    }
}

/**
 * Timer-triggered daily sync (runs at midnight UTC).
 */
async function scheduledSyncEvalMetrics(_timer: Timer, context: InvocationContext): Promise<void> {
    context.log("Scheduled eval metrics sync started");
    try {
        const result = await runSync(context);
        context.log(`Scheduled sync complete: synced ${result.synced} entries`);
    } catch (err: any) {
        context.log("Scheduled sync failed:", err.message);
    }
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

app.http("syncMsbenchEvalMetrics", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "msbench-eval-metrics/sync",
    handler: syncMsbenchEvalMetrics,
});

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

app.timer("scheduledSyncEvalMetrics", {
    schedule: "0 0 13 * * *",  // daily at 13:00 UTC
    handler: scheduledSyncEvalMetrics,
});
