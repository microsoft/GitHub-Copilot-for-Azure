import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import { createHash } from "node:crypto";
import { listMsbenchDates, enumerateMsbenchBlobs, getMsbenchBlobContent } from "../msbenchBlobEnumerator";
import type { BlobTreeNode } from "../shared/blobTree";

const MSBENCH_STORAGE_ACCOUNT = process.env.MSBENCH_STORAGE_ACCOUNT;
const EVAL_TABLE_NAME = process.env.MSBENCH_EVAL_TABLE_NAME;
const EVAL_REPORT_PATTERN = /^.*_eval_report\.json$/;

interface EvalReport {
    total_consumed_tokens: number;
    total_steps: number;
    model: string;
    instance_id: string;
    benchmark?: string;
    resolved?: boolean;
    [key: string]: unknown;
}

interface EvalReportWithPath extends EvalReport {
    blobPath: string;
}

function toSafeString(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function buildMsbenchRowKey(instanceId: string, benchmark: string, model: string): string {
    const payload = JSON.stringify([instanceId, benchmark, model]);
    return createHash("sha256").update(payload).digest("base64url");
}

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

async function getProcessedDates(tableClient: TableClient): Promise<Set<string>> {
    const dates = new Set<string>();
    for await (const entity of tableClient.listEntities({
        queryOptions: { select: ["partitionKey"] },
    })) {
        if (entity.partitionKey) dates.add(entity.partitionKey);
    }
    return dates;
}

async function deleteDatePartition(tableClient: TableClient, partitionKey: string, context: InvocationContext): Promise<number> {
    let deleted = 0;
    for await (const entity of tableClient.listEntities({
        queryOptions: {
            filter: `PartitionKey eq '${partitionKey}'`,
            select: ["rowKey"],
        },
    })) {
        await tableClient.deleteEntity(partitionKey, entity.rowKey);
        deleted++;
    }

    context.log(`Deleted ${deleted} existing rows for date ${partitionKey} before re-sync`);
    return deleted;
}

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

    // Process each date sequentially to avoid overwhelming the storage account with parallel requests
    // For each date, we download eval_report.json files with limited concurrency to balance speed and resource usage
    const CONCURRENCY_LIMIT = 5;
    let totalSynced = 0;

    // Process dates sequentially to avoid unbounded parallelism
    for (const date of datesToProcess) {
        const tree = await enumerateMsbenchBlobs(`${date}/`);
        const dateNode = tree[date];
        if (!dateNode) continue;

        if (force) {
            await deleteDatePartition(tableClient, date, context);
        }

        const evalPaths = collectEvalReportPaths(dateNode);

        // Download reports with bounded concurrency
        const reports: (EvalReportWithPath | null)[] = [];
        for (let i = 0; i < evalPaths.length; i += CONCURRENCY_LIMIT) {
            const batch = evalPaths.slice(i, i + CONCURRENCY_LIMIT);
            const batchResults = await Promise.all(
                batch.map(async (path) => {
                    try {
                        const raw = await getMsbenchBlobContent(path);
                        const report = JSON.parse(raw) as EvalReport;
                        return { ...report, blobPath: path };
                    } catch {
                        context.log(`Skipping malformed eval report: ${path}`);
                        return null;
                    }
                })
            );
            reports.push(...batchResults);
        }

        for (const report of reports) {
            if (!report) continue;
            const fallbackInstanceId = `path:${report.blobPath}`;
            const instanceId = toSafeString(report.instance_id) ?? fallbackInstanceId;
            const benchmark = toSafeString(report.benchmark) ?? instanceId;
            const model = toSafeString(report.model) ?? "unknown";

            await tableClient.upsertEntity({
                partitionKey: date,
                rowKey: buildMsbenchRowKey(instanceId, benchmark, model),
                instance_id: instanceId,
                benchmark,
                model,
                totalConsumedTokens: Number(report.total_consumed_tokens) || 0,
                totalSteps: Number(report.total_steps) || 0,
                resolved: report.resolved ? 1 : 0,
            });
            totalSynced++;
        }
    }

    return { synced: totalSynced, dates: datesToProcess };
}

async function syncMsbenchEvalMetrics(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

async function scheduledSyncEvalMetrics(_timer: Timer, context: InvocationContext): Promise<void> {
    context.log("Scheduled eval metrics sync started");
    try {
        const result = await runSync(context);
        context.log(`Scheduled sync complete: synced ${result.synced} entries`);
    } catch (err: any) {
        context.log("Scheduled sync failed:", err.message);
    }
}

app.http("syncMsbenchEvalMetrics", {
    methods: ["POST"],
    authLevel: "function",
    route: "msbench-eval-metrics/sync",
    handler: syncMsbenchEvalMetrics,
});

app.timer("scheduledSyncEvalMetrics", {
    schedule: "0 0 13 * * *",  // daily at 13:00 UTC
    handler: scheduledSyncEvalMetrics,
});
