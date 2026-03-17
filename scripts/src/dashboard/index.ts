/**
 * Dashboard report types, validation, and sanitization.
 */

export {
  type DashboardReport,
  type CategoryStatus,
  type CategoryReport,
  type CategoryItem,
  type CollectorOptions,
  type Collector,
  validateDashboardReport,
  validateCategoryReport,
} from "./schema.js";

export {
  stripHtml,
  redactSecrets,
  truncate,
  normalizeWhitespace,
  sanitize,
  sanitizeCategoryReport,
  sanitizeDashboardReport,
} from "./sanitize.js";
