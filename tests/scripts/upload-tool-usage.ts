#!/usr/bin/env tsx

/**
 * Tool Usage Uploader
 *
 * Reads the per-run tool-usage files produced by the integration test run
 * (tool-usage-<token>.json under the reports directory) and uploads one row per
 * tool call to an Azure Table. The table provides the durable, queryable history
 * that powers the dashboard's per-run tool review.
 *
 * Granularity: one row per tool call (per run, per test, per branch, per run id).
 * Full tool arguments are NOT stored here — they remain in the per-run blob and
 * are fetched on demand by the dashboard. Only name/order/success are uploaded.
 *
 * Authentication uses DefaultAzureCredential, which picks up the Azure session
 * established earlier in the workflow (azure/login / az login).
 *
 * Required environment variables:
 *   TOOL_USAGE_STORAGE_ACCOUNT  Storage account that hosts the table.
 *   TOOL_USAGE_TABLE_NAME       Name of the Azure Table (e.g. integrationtoolusage).
 *   SKILL                       Skill under test (becomes the PartitionKey).
 *   BRANCH                      Git branch (e.g. github.ref_name).
 *   RUN_ID                      Unique run identifier (e.g. github.run_id).
 *
 * Optional:
 *   TOOL_USAGE_REPORTS_DIR      Reports directory to scan (default: tests/reports).
 *
 * The script is a no-op (exit 0) when the storage account/table is not
 * configured or when no tool-usage files are found, so it can be wired
 * unconditionally into pipelines without breaking runs that lack the data.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { TableClient } from "@azure/data-tables";
import type { TransactionAction } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOL_USAGE_PREFIX = "tool-usage-";
const TOOL_USAGE_SUFFIX = ".json";

/** A single tool call as written by agent-runner.ts computeToolUsage. */
export interface ToolCallRecord {
  order: number;
  toolName: string;
  toolCallId: string;
  success?: boolean | null;
  durationMs?: number | null;
  outputBytes?: number | null;
}

/** A per-run tool-usage file as written by agent-runner.ts writeMarkdownReport. */
export interface ToolUsageFile {
  testName: string;
  reportFile?: string;
  sessionId?: string | null;
  model?: string;
  timestamp?: string;
  toolCalls?: ToolCallRecord[];
}

/** One table-ready row representing a single tool call. */
export interface ToolUsageRow {
  partitionKey: string;
  rowKey: string;
  skill: string;
  testName: string;
  branch: string;
  runId: string;
  runDate: string;
  runTimestamp: string;
  runToken: string;
  reportFile: string;
  sessionId: string;
  model: string;
  order: number;
  toolName: string;
  toolCallId: string;
  successState: string;
  /**
   * Wall-clock duration in milliseconds, omitted when no completion was observed
   * (so the Table entity has no property rather than a null value).
   */
  durationMs?: number;
  /**
   * UTF-8 byte size of the tool's full textual output, omitted when no
   * completion was observed.
   */
  outputBytes?: number;
}

/** Context shared by every row produced from a single upload invocation. */
export interface UploadContext {
  skill: string;
  branch: string;
  runId: string;
}

/**
 * Sanitize a value for use in an Azure Table key. Table keys cannot contain
 * the characters / \ # ? or control characters, and are length-limited.
 */
export function sanitizeKey(value: string): string {
  let result = "";
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    const isForbidden = ch === "/" || ch === "\\" || ch === "#" || ch === "?";
    const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    result += isForbidden || isControl ? "-" : ch;
  }
  return result.substring(0, 700);
}

/**
 * Build a collision-resistant RowKey for a single tool call. Sanitization can
 * map distinct tuples to the same string and long names get truncated, so a
 * short hash of the original, unsanitized tuple is appended to keep otherwise-
 * colliding rows distinct.
 */
export function buildToolRowKey(
  branch: string,
  runId: string,
  testName: string,
  runToken: string,
  order: number,
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${branch}\u0000${runId}\u0000${testName}\u0000${runToken}\u0000${order}`)
    .digest("hex")
    .slice(0, 16);
  const prefix = sanitizeKey(
    `${branch}__${runId}__${testName}__${runToken}__${order}`,
  ).substring(0, 600);
  return `${prefix}__${hash}`;
}

/** Derive the shared run token from a tool-usage-<token>.json file name. */
export function deriveRunToken(fileName: string): string {
  const base = path.basename(fileName);
  if (base.startsWith(TOOL_USAGE_PREFIX) && base.endsWith(TOOL_USAGE_SUFFIX)) {
    return base.slice(TOOL_USAGE_PREFIX.length, base.length - TOOL_USAGE_SUFFIX.length);
  }
  return base;
}

/** Map a captured success value (true/false/null/undefined) to a stored state. */
export function successStateOf(success: boolean | null | undefined): string {
  if (success === true) return "true";
  if (success === false) return "false";
  return "unknown";
}

/** Expand one per-run tool-usage file into one table row per tool call. */
export function expandToolUsageToRows(
  file: ToolUsageFile,
  runToken: string,
  ctx: UploadContext,
): ToolUsageRow[] {
  const timestamp = file.timestamp || new Date().toISOString();
  const runDate = timestamp.slice(0, 10);
  const partitionKey = sanitizeKey(ctx.skill);
  const rows: ToolUsageRow[] = [];
  for (const call of file.toolCalls ?? []) {
    const row: ToolUsageRow = {
      partitionKey,
      rowKey: buildToolRowKey(ctx.branch, ctx.runId, file.testName, runToken, call.order),
      skill: ctx.skill,
      testName: file.testName,
      branch: ctx.branch,
      runId: ctx.runId,
      runDate,
      runTimestamp: timestamp,
      runToken,
      reportFile: file.reportFile || "",
      sessionId: file.sessionId || "",
      model: file.model || "unknown",
      order: call.order,
      toolName: call.toolName,
      toolCallId: call.toolCallId,
      successState: successStateOf(call.success),
    };
    if (typeof call.durationMs === "number") {
      row.durationMs = call.durationMs;
    }
    if (typeof call.outputBytes === "number") {
      row.outputBytes = call.outputBytes;
    }
    rows.push(row);
  }
  return rows;
}

/** Maximum number of entities allowed in a single Azure Table transaction. */
export const MAX_TABLE_BATCH_SIZE = 100;

/**
 * Group rows into Azure Table transaction batches. A transaction requires every
 * entity in the batch to share a PartitionKey and allows at most 100 entities,
 * so rows are grouped by `partitionKey` and then chunked to `maxBatchSize`.
 */
export function groupRowsForTransactions(
  rows: ToolUsageRow[],
  maxBatchSize: number = MAX_TABLE_BATCH_SIZE,
): ToolUsageRow[][] {
  const byPartition = new Map<string, ToolUsageRow[]>();
  for (const row of rows) {
    const list = byPartition.get(row.partitionKey);
    if (list) list.push(row);
    else byPartition.set(row.partitionKey, [row]);
  }
  const batches: ToolUsageRow[][] = [];
  for (const list of byPartition.values()) {
    for (let i = 0; i < list.length; i += maxBatchSize) {
      batches.push(list.slice(i, i + maxBatchSize));
    }
  }
  return batches;
}

/** True when an Azure error indicates the caller lacks table write permission. */
function isPermissionError(err: unknown): boolean {
  const e = err as { statusCode?: number; code?: string };
  return e?.statusCode === 403 || e?.code === "AuthorizationPermissionMismatch";
}

/**
 * Render an Azure/REST error with the fields that actually help diagnose it:
 * the OData error code, HTTP status, and the service message.
 */
function formatAzureError(err: unknown): string {
  const e = err as {
    code?: string;
    statusCode?: number;
    message?: string;
    details?: { odataError?: { message?: { value?: string } } };
  };
  const parts: string[] = [];
  if (e?.code) parts.push(`code=${e.code}`);
  if (typeof e?.statusCode === "number") parts.push(`statusCode=${e.statusCode}`);
  const serviceMessage = e?.details?.odataError?.message?.value || e?.message;
  if (serviceMessage) parts.push(`message=${serviceMessage}`);
  return parts.length > 0 ? parts.join(" ") : String(err);
}

/**
 * Validate a name against the Azure Table naming rules and throw an actionable
 * error if it is invalid.
 */
function assertValidTableName(name: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]{2,62}$/.test(name)) {
    throw new Error(
      `Invalid TOOL_USAGE_TABLE_NAME '${name}'. Azure Table names must be ` +
        "alphanumeric only (no hyphens, underscores, or dots), must start with a " +
        "letter, and be 3-63 characters long (e.g. 'integrationtoolusage').",
    );
  }
}

/** Recursively find all tool-usage-*.json files under a directory. */
export function findToolUsageFiles(dir: string): string[] {
  const found: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findToolUsageFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.startsWith(TOOL_USAGE_PREFIX) &&
      entry.name.endsWith(TOOL_USAGE_SUFFIX)
    ) {
      found.push(full);
    }
  }
  return found;
}

/** Parse a tool-usage-<token>.json file, returning null when unreadable/invalid. */
export function parseToolUsageFile(filePath: string): ToolUsageFile | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.testName === "string" && Array.isArray(parsed.toolCalls)) {
      return parsed as ToolUsageFile;
    }
  } catch {
    // skip malformed files
  }
  return null;
}

async function main(): Promise<void> {
  const storageAccount = process.env.TOOL_USAGE_STORAGE_ACCOUNT;
  const tableName = process.env.TOOL_USAGE_TABLE_NAME;
  const skill = process.env.SKILL || "unknown";
  const branch = process.env.BRANCH || "unknown";
  const runId = process.env.RUN_ID || "unknown";
  const reportsDir = process.env.TOOL_USAGE_REPORTS_DIR || path.resolve(__dirname, "../reports");

  if (!storageAccount || !tableName) {
    console.log(
      "TOOL_USAGE_STORAGE_ACCOUNT or TOOL_USAGE_TABLE_NAME not set; skipping tool usage upload.",
    );
    return;
  }

  assertValidTableName(tableName);

  const files = findToolUsageFiles(reportsDir);
  if (files.length === 0) {
    console.log(`No ${TOOL_USAGE_PREFIX}*.json files found under ${reportsDir}; nothing to upload.`);
    return;
  }

  const ctx: UploadContext = { skill, branch, runId };
  const rows: ToolUsageRow[] = [];
  for (const file of files) {
    const parsed = parseToolUsageFile(file);
    if (!parsed) continue;
    rows.push(...expandToolUsageToRows(parsed, deriveRunToken(file), ctx));
  }

  if (rows.length === 0) {
    console.log("No valid tool call records found; nothing to upload.");
    return;
  }

  const credential = new DefaultAzureCredential();
  const tableEndpoint = `https://${storageAccount}.table.core.windows.net`;
  const tableClient = new TableClient(tableEndpoint, tableName, credential);

  console.log(
    `Uploading tool usage to ${tableEndpoint} table='${tableName}' ` +
      `(skill='${skill}', branch='${branch}', run='${runId}', rows=${rows.length}).`,
  );

  // Ensure the table exists (idempotent; ignores "already exists").
  try {
    await tableClient.createTable();
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode !== 409) {
      console.error(`createTable failed for table='${tableName}': ${formatAzureError(err)}`);
      throw err;
    }
  }

  const batches = groupRowsForTransactions(rows);
  let uploaded = 0;
  for (const batch of batches) {
    const actions: TransactionAction[] = batch.map((row) => ["upsert", { ...row }, "Replace"]);
    try {
      await tableClient.submitTransaction(actions);
    } catch (err) {
      console.error(
        `submitTransaction failed for table='${tableName}' ` +
          `partitionKey='${batch[0]?.partitionKey}' size=${batch.length}: ${formatAzureError(err)}`,
      );
      throw err;
    }
    uploaded += batch.length;
  }

  console.log(
    `Uploaded ${uploaded} tool call row(s) in ${batches.length} batch(es) ` +
      `for skill='${skill}', branch='${branch}', run='${runId}'.`,
  );
}

// Only run when executed directly (not when imported by tests).
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    // Tool usage upload is auxiliary telemetry; a missing/incorrect table-write
    // role assignment should surface a clear warning but must not fail the run.
    if (isPermissionError(err)) {
      console.warn(
        "WARNING: Skipping tool usage upload - the workflow identity lacks " +
          "'Storage Table Data Contributor' on the storage account. Grant the role to enable uploads.",
      );
      return;
    }
    console.error("Failed to upload tool usage:", formatAzureError(err));
    process.exit(1);
  });
}
