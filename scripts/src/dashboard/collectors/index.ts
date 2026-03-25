/**
 * Collector registry — barrel export for all available dashboard collectors.
 */

export { default as testsCollector } from "./tests.js";
export { default as coverageCollector } from "./coverage.js";
export { default as lintCollector } from "./lint.js";
export { default as typecheckCollector } from "./typecheck.js";
export { default as tokensCollector } from "./tokens.js";
export { frontmatterCollector } from "./frontmatter.js";
export { referencesCollector } from "./references.js";
export { default as integrationCollector } from "./integration.js";
