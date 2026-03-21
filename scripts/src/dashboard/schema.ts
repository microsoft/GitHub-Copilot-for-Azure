/**
 * Dashboard report schema types and validation.
 *
 * Defines the core data model for repository health dashboard reports,
 * including collector interfaces and runtime validation functions.
 */

// -- Types ------------------------------------------------------------------

/**
 * Top-level report produced by the dashboard pipeline.
 * Contains metadata about the repository state and one or more category
 * reports collected by individual collectors.
 */
export interface DashboardReport {
  schema: "dashboard-report/v1";
  generatedAt: string;
  branch: string;
  commit: string;
  commitMessage: string;
  categories: Record<string, CategoryReport>;
}

export type CategoryStatus = "pass" | "fail" | "warn" | "skip";

/**
 * Report produced by a single collector (e.g. tests, lint, coverage).
 */
export interface CategoryReport {
  status: CategoryStatus;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  items: CategoryItem[];
  collectedAt: string;
  collectorVersion: string;
}

export interface CategoryItem {
  name: string;
  status: CategoryStatus;
  message?: string;
  metadata?: Record<string, string | number | boolean>;
}

/** Options passed to every collector. */
export interface CollectorOptions {
  cwd: string;
  timeout: number;
  skipRun?: boolean;
}

/** Interface that all dashboard collectors must implement. */
export interface Collector {
  name: string;
  version: string;
  collect(options: CollectorOptions): Promise<CategoryReport>;
}

// -- Validation helpers -----------------------------------------------------

const VALID_STATUSES: readonly string[] = ["pass", "fail", "warn", "skip"];

const COMMIT_SHA_REGEX = /^[0-9a-f]{40}$/;
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+/;

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidISODate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!ISO_8601_REGEX.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

function isValidStatus(value: unknown): boolean {
  return typeof value === "string" && VALID_STATUSES.includes(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// -- Public validation functions --------------------------------------------

/**
 * Validate a {@link CategoryReport} at runtime.
 *
 * Returns `{ valid: true, errors: [] }` when all required fields are present
 * and correctly typed, or `{ valid: false, errors: [...] }` listing every
 * violation found. Extra fields are accepted for forward compatibility.
 */
export function validateCategoryReport(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return { valid: false, errors: ["CategoryReport must be an object"] };
  }

  // status
  if (!("status" in data)) {
    errors.push("Missing required field: status");
  } else if (!isValidStatus(data.status)) {
    errors.push(
      `Invalid status: "${String(data.status)}", must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }

  // summary
  if (!("summary" in data)) {
    errors.push("Missing required field: summary");
  } else if (!isRecord(data.summary)) {
    errors.push("summary must be an object");
  } else {
    const fields = ["total", "passed", "failed", "warnings", "skipped"] as const;
    for (const field of fields) {
      if (!(field in data.summary)) {
        errors.push(`Missing required field: summary.${field}`);
      } else if (!isNonNegativeInteger(data.summary[field])) {
        errors.push(
          `summary.${field} must be a non-negative integer, got: ${String(data.summary[field])}`
        );
      }
    }
  }

  // items
  if (!("items" in data)) {
    errors.push("Missing required field: items");
  } else if (!Array.isArray(data.items)) {
    errors.push("items must be an array");
  } else {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i] as unknown;
      if (!isRecord(item)) {
        errors.push(`items[${i}] must be an object`);
        continue;
      }
      if (typeof item.name !== "string") {
        errors.push(`items[${i}].name must be a string`);
      }
      if (!isValidStatus(item.status)) {
        errors.push(`items[${i}].status is invalid: "${String(item.status)}"`);
      }
      if ("message" in item && item.message !== undefined) {
        if (typeof item.message !== "string") {
          errors.push(`items[${i}].message must be a string`);
        }
      }
      if ("metadata" in item && item.metadata !== undefined) {
        if (!isRecord(item.metadata)) {
          errors.push(`items[${i}].metadata must be an object`);
        } else {
          for (const [key, val] of Object.entries(item.metadata)) {
            const t = typeof val;
            if (t !== "string" && t !== "number" && t !== "boolean") {
              errors.push(
                `items[${i}].metadata.${key} must be string, number, or boolean`
              );
            }
          }
        }
      }
    }
  }

  // collectedAt
  if (!("collectedAt" in data)) {
    errors.push("Missing required field: collectedAt");
  } else if (!isValidISODate(data.collectedAt)) {
    errors.push(
      `Invalid ISO-8601 date for collectedAt: "${String(data.collectedAt)}"`
    );
  }

  // collectorVersion
  if (!("collectorVersion" in data)) {
    errors.push("Missing required field: collectorVersion");
  } else if (typeof data.collectorVersion !== "string") {
    errors.push("collectorVersion must be a string");
  } else if (!SEMVER_REGEX.test(data.collectorVersion)) {
    errors.push(
      `Invalid semver for collectorVersion: "${data.collectorVersion}"`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a {@link DashboardReport} at runtime.
 *
 * Checks that all required top-level fields are present and correctly typed.
 * Category reports are validated recursively. Extra top-level fields are
 * accepted for forward compatibility.
 */
export function validateDashboardReport(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(data)) {
    return { valid: false, errors: ["DashboardReport must be an object"] };
  }

  // schema
  if (!("schema" in data)) {
    errors.push("Missing required field: schema");
  } else if (data.schema !== "dashboard-report/v1") {
    errors.push(
      `Invalid schema: "${String(data.schema)}", expected "dashboard-report/v1"`
    );
  }

  // generatedAt
  if (!("generatedAt" in data)) {
    errors.push("Missing required field: generatedAt");
  } else if (!isValidISODate(data.generatedAt)) {
    errors.push(
      `Invalid ISO-8601 date for generatedAt: "${String(data.generatedAt)}"`
    );
  }

  // branch
  if (!("branch" in data)) {
    errors.push("Missing required field: branch");
  } else if (typeof data.branch !== "string") {
    errors.push("branch must be a string");
  }

  // commit
  if (!("commit" in data)) {
    errors.push("Missing required field: commit");
  } else if (typeof data.commit !== "string") {
    errors.push("commit must be a string");
  } else if (data.commit !== "" && !COMMIT_SHA_REGEX.test(data.commit)) {
    errors.push(
      `Invalid commit SHA: "${data.commit}", must be 40 hex characters or empty string`
    );
  }

  // commitMessage
  if (!("commitMessage" in data)) {
    errors.push("Missing required field: commitMessage");
  } else if (typeof data.commitMessage !== "string") {
    errors.push("commitMessage must be a string");
  }

  // categories
  if (!("categories" in data)) {
    errors.push("Missing required field: categories");
  } else if (!isRecord(data.categories)) {
    errors.push("categories must be an object");
  } else {
    for (const [key, value] of Object.entries(data.categories)) {
      const result = validateCategoryReport(value);
      if (!result.valid) {
        for (const err of result.errors) {
          errors.push(`categories.${key}: ${err}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
