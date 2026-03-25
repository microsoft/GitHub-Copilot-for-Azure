/**
 * Sanitization utilities for dashboard report data.
 *
 * All report strings pass through these functions before inclusion in the
 * final JSON to prevent secret leakage, XSS via stored HTML, and unbounded
 * field sizes.
 */

import type { CategoryReport, DashboardReport } from "./schema.js";

/**
 * Strip HTML tags from a string.
 * Uses a simple character-by-character state machine instead of regex on
 * untrusted input for security.
 */
export function stripHtml(input: string): string {
  let result = "";
  let inTag = false;

  for (const char of input) {
    if (char === "<") {
      inTag = true;
    } else if (char === ">" && inTag) {
      inTag = false;
    } else if (!inTag) {
      result += char;
    }
  }

  return result;
}

/** Known API-key prefix patterns. The full token is replaced. */
const API_KEY_PATTERNS: RegExp[] = [
  /\bghp_[A-Za-z0-9]{36,}\b/g,
  /\bghs_[A-Za-z0-9]{36,}\b/g,
  /\bgho_[A-Za-z0-9]{36,}\b/g,
  /\bghu_[A-Za-z0-9]{36,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[A-Z0-9]{16}\b/g,
];

/**
 * Redact patterns that look like secrets.
 *
 * Targets:
 * - Known API key prefixes (ghp_, ghs_, gho_, ghu_, github_pat_, sk-, AKIA…)
 * - Connection-string fields (AccountKey=, SharedAccessKey=, Password=)
 * - Generic key=value where the key contains a sensitive word
 *   (secret, password, token, key, credential, apikey, api_key, access_key)
 *
 * Returns the input with matched values replaced by `[REDACTED]`.
 */
export function redactSecrets(input: string): string {
  let result = input;

  // 1. Known API-key prefixes → full replacement
  for (const pattern of API_KEY_PATTERNS) {
    result = result.replace(
      new RegExp(pattern.source, pattern.flags),
      "[REDACTED]"
    );
  }

  // 2. Connection-string sensitive fields → keep field name
  result = result.replace(
    /\b(AccountKey|SharedAccessKey|Password)\s*=\s*[^;"\s]+/gi,
    "$1=[REDACTED]"
  );

  // 3. Generic sensitive key=value → keep key name + separator
  //    Exclude [ and ] from value match to avoid re-matching "[REDACTED]"
  //    produced by earlier passes.
  result = result.replace(
    /\b([\w-]*(secret|password|token|key|credential|apikey|api_key|access_key)[\w-]*)(\s*[=:]\s*)([^\s;,"'[\]]{3,})/gi,
    "$1$3[REDACTED]"
  );

  return result;
}

/**
 * Truncate a string to {@link maxLength} characters, appending `"..."` when
 * the input is longer.
 *
 * @param maxLength - Content character limit (default `500`). The returned
 *   string may be up to `maxLength + 3` characters when truncated.
 */
export function truncate(input: string, maxLength = 500): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength) + "...";
}

/**
 * Collapse runs of whitespace (spaces, tabs, newlines) to a single space
 * and trim leading/trailing whitespace.
 */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Full sanitization pipeline applied in order:
 * strip HTML → redact secrets → truncate → normalize whitespace.
 */
export function sanitize(input: string, maxLength = 500): string {
  return normalizeWhitespace(
    truncate(redactSecrets(stripHtml(input)), maxLength)
  );
}

/**
 * Sanitize every string field in a {@link CategoryReport}'s items.
 * Returns a shallow-copied report with sanitized item messages.
 */
export function sanitizeCategoryReport(report: CategoryReport): CategoryReport {
  return {
    ...report,
    items: report.items.map((item) => ({
      ...item,
      message:
        item.message !== undefined ? sanitize(item.message, 500) : undefined,
    })),
  };
}

/**
 * Sanitize a full {@link DashboardReport}: the commit message and every
 * category report.
 */
export function sanitizeDashboardReport(
  report: DashboardReport
): DashboardReport {
  const categories: Record<string, CategoryReport> = {};
  for (const [key, cat] of Object.entries(report.categories)) {
    categories[key] = sanitizeCategoryReport(cat);
  }
  return {
    ...report,
    commitMessage: sanitize(report.commitMessage, 200),
    categories,
  };
}
