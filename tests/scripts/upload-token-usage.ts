#!/usr/bin/env tsx

/**
 * Token Usage Uploader
 *
 * Reads the per-test token usage produced by the integration test run
 * (token-summary.jsonl files under the reports directory) and uploads one
 * aggregated row per test to an Azure Table. The table provides the durable,
 * queryable history that powers the dashboard's "token usage over time" page.
 *
 * Granularity: one row per test, per branch, per run. Multiple records for the
 * same test within a run (e.g. retries) are summed into a single row.
 *
 * Authentication uses DefaultAzureCredential, which picks up the Azure session
 * established earlier in the workflow (azure/login / az login).
 *
 * Required environment variables:
 *   TOKEN_USAGE_STORAGE_ACCOUNT  Storage account that hosts the table.
 *   TOKEN_USAGE_TABLE_NAME       Name of the Azure Table (e.g. integrationtokenusage).
 *   SKILL                        Skill under test (becomes the PartitionKey).
 *   BRANCH                       Git branch (e.g. github.ref_name).
 *   RUN_ID                       Unique run identifier (e.g. github.run_id).
 *
 * Optional:
 *   TOKEN_USAGE_REPORTS_DIR      Reports directory to scan (default: tests/reports).
 *
 * The script is a no-op (exit 0) when the storage account/table is not
 * configured or when no token-summary.jsonl files are found, so it can be wired
 * unconditionally into pipelines without breaking runs that lack the data.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_SUMMARY_FILENAME = "token-summary.jsonl";

/** A single record as written by agent-runner.ts writeTokenUsageJson. */
interface TokenSummaryRecord {
    testName: string;
    timestamp?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
}

/** One aggregated, table-ready row for a single test within a run. */
interface AggregatedUsage {
    testName: string;
    model: string;
    timestamp: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
}

/**
 * Sanitize a value for use in an Azure Table key. Table keys cannot contain
 * the characters / \ # ? or control characters, and are length-limited.
 */
function sanitizeKey(value: string): string {
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
 * Build a collision-resistant RowKey for a (branch, runId, testName) tuple.
 * Sanitization can map distinct tuples to the same string (e.g. "a/b" and
 * "a-b") and long names get truncated, so a short hash of the original,
 * unsanitized tuple is appended to keep otherwise-colliding rows distinct.
 */
function buildRowKey(branch: string, runId: string, testName: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${branch}\u0000${runId}\u0000${testName}`)
    .digest("hex")
    .slice(0, 16);
  const prefix = sanitizeKey(`${branch}__${runId}__${testName}`).substring(0, 600);
  return `${prefix}__${hash}`;
}

/** True when an Azure error indicates the caller lacks table write permission. */
function isPermissionError(err: unknown): boolean {
  const e = err as { statusCode?: number; code?: string };
  return e?.statusCode === 403 || e?.code === "AuthorizationPermissionMismatch";
}

/**
 * Render an Azure/REST error with the fields that actually help diagnose it:
 * the OData error code, HTTP status, and the service message. The Azure SDK
 * surfaces these as `code` / `statusCode` on the error; the readable message
 * may live on `.message` or in the parsed `.details` body.
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
 * error if it is invalid. Table names must be alphanumeric only, may not start
 * with a digit, and must be 3-63 characters long. Violations otherwise surface
 * from the service as an opaque "InvalidResourceName" error.
 */
function assertValidTableName(name: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]{2,62}$/.test(name)) {
    throw new Error(
      `Invalid TOKEN_USAGE_TABLE_NAME '${name}'. Azure Table names must be ` +
        "alphanumeric only (no hyphens, underscores, or dots), must start with a " +
        "letter, and be 3-63 characters long (e.g. 'integrationtokenusage').",
    );
  }
}

/** Recursively find all token-summary.jsonl files under a directory. */
function findTokenSummaryFiles(dir: string): string[] {
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
      found.push(...findTokenSummaryFiles(full));
    } else if (entry.isFile() && entry.name === TOKEN_SUMMARY_FILENAME) {
      found.push(full);
    }
  }
  return found;
}

/** Parse a token-summary.jsonl file into individual records. */
function parseTokenSummary(filePath: string): TokenSummaryRecord[] {
  const records: TokenSummaryRecord[] = [];
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return records;
  }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.testName === "string") {
        records.push(parsed as TokenSummaryRecord);
      }
    } catch {
      // skip malformed lines
    }
  }
  return records;
}

/** Sum multiple records per test into a single aggregated row. */
function aggregateByTest(records: TokenSummaryRecord[]): AggregatedUsage[] {
  const byTest = new Map<string, AggregatedUsage>();
  for (const r of records) {
    const existing = byTest.get(r.testName);
    const input = Number(r.inputTokens) || 0;
    const output = Number(r.outputTokens) || 0;
    const cacheRead = Number(r.cacheReadTokens) || 0;
    const cacheWrite = Number(r.cacheWriteTokens) || 0;
    if (existing) {
      existing.inputTokens += input;
      existing.outputTokens += output;
      existing.cacheReadTokens += cacheRead;
      existing.cacheWriteTokens += cacheWrite;
      if (r.timestamp && r.timestamp > existing.timestamp) {
        existing.timestamp = r.timestamp;
        if (r.model) existing.model = r.model;
      }
    } else {
      byTest.set(r.testName, {
        testName: r.testName,
        model: r.model || "unknown",
        timestamp: r.timestamp || new Date().toISOString(),
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
      });
    }
  }
  return [...byTest.values()];
}

async function main(): Promise<void> {
  const storageAccount = process.env.TOKEN_USAGE_STORAGE_ACCOUNT;
  const tableName = process.env.TOKEN_USAGE_TABLE_NAME;
  const skill = process.env.SKILL || "unknown";
  const branch = process.env.BRANCH || "unknown";
  const runId = process.env.RUN_ID || "unknown";
  const reportsDir = process.env.TOKEN_USAGE_REPORTS_DIR || path.resolve(__dirname, "../reports");

  if (!storageAccount || !tableName) {
    console.log(
      "TOKEN_USAGE_STORAGE_ACCOUNT or TOKEN_USAGE_TABLE_NAME not set; skipping token usage upload.",
    );
    return;
  }

  // Fail fast with an actionable message rather than an opaque service error.
  assertValidTableName(tableName);

  const files = findTokenSummaryFiles(reportsDir);
  if (files.length === 0) {
    console.log(`No ${TOKEN_SUMMARY_FILENAME} files found under ${reportsDir}; nothing to upload.`);
    return;
  }

  const allRecords: TokenSummaryRecord[] = [];
  for (const file of files) {
    allRecords.push(...parseTokenSummary(file));
  }

  const aggregated = aggregateByTest(allRecords);
  if (aggregated.length === 0) {
    console.log("No valid token usage records found; nothing to upload.");
    return;
  }

  const credential = new DefaultAzureCredential();
  const tableEndpoint = `https://${storageAccount}.table.core.windows.net`;
  const tableClient = new TableClient(tableEndpoint, tableName, credential);

  console.log(
    `Uploading token usage to ${tableEndpoint} table='${tableName}' ` +
      `(skill='${skill}', branch='${branch}', run='${runId}', rows=${aggregated.length}).`,
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

  let uploaded = 0;
  for (const usage of aggregated) {
    const totalTokens = usage.inputTokens + usage.outputTokens;
    const runDate = usage.timestamp.slice(0, 10);
    const partitionKey = sanitizeKey(skill);
    const rowKey = buildRowKey(branch, runId, usage.testName);
    try {
      await tableClient.upsertEntity(
        {
          partitionKey,
          rowKey,
          skill,
          testName: usage.testName,
          branch,
          runId,
          runDate,
          runTimestamp: usage.timestamp,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          totalTokens,
        },
        "Replace",
      );
    } catch (err) {
      console.error(
        `upsertEntity failed for table='${tableName}' ` +
          `partitionKey='${partitionKey}' rowKey='${rowKey}': ${formatAzureError(err)}`,
      );
      throw err;
    }
    uploaded++;
  }

  console.log(
    `Uploaded ${uploaded} token usage row(s) for skill='${skill}', branch='${branch}', run='${runId}'.`,
  );
}

main().catch((err) => {
  // Token usage upload is auxiliary telemetry; a missing/incorrect table-write
  // role assignment should surface a clear warning but must not fail the run.
  if (isPermissionError(err)) {
    console.warn(
      "WARNING: Skipping token usage upload - the workflow identity lacks " +
        "'Storage Table Data Contributor' on the storage account. Grant the role to enable uploads.",
    );
    return;
  }
  console.error("Failed to upload token usage:", formatAzureError(err));
  process.exit(1);
});
