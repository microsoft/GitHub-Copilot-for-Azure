/**
 * Shared types and utilities for token management
 */

import { extname } from 'node:path';
import * as micromatch from "micromatch";

export interface TokenCount {
  readonly tokens: number;
  readonly characters: number;
  readonly lines: number;
  readonly lastUpdated: string;
}

export interface TokenMetadata {
  readonly generatedAt: string;
  readonly totalTokens: number;
  readonly totalFiles: number;
  readonly files: Record<string, TokenCount>;
}

/**
 * Configuration for token limits across different file types.
 * Used to enforce consistent token budgets for markdown files.
 */
export interface TokenLimitsConfig {
  readonly description?: string;
  readonly defaults: Record<string, number>;
  readonly overrides: Record<string, number>;
}

/**
 * Result of validating a single file against token limits.
 */
export interface ValidationResult {
  readonly file: string;
  readonly tokens: number;
  readonly limit: number;
  readonly exceeded: boolean;
  readonly pattern: string;
}

export interface ValidationReport {
  readonly timestamp: string;
  readonly totalFiles: number;
  readonly exceededCount: number;
  readonly results: ValidationResult[];
}

export interface FileTokens {
  readonly tokens: number;
  readonly characters: number;
  readonly lines: number;
}

export interface FileComparison {
  readonly file: string;
  readonly before: FileTokens | null;
  readonly after: FileTokens | null;
  readonly diff: number;
  readonly percentChange: number;
  readonly status: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface ComparisonSummary {
  readonly totalBefore: number;
  readonly totalAfter: number;
  readonly totalDiff: number;
  readonly percentChange: number;
  readonly filesAdded: number;
  readonly filesRemoved: number;
  readonly filesModified: number;
  readonly filesIncreased: number;
  readonly filesDecreased: number;
}

export interface ComparisonReport {
  readonly baseRef: string;
  readonly headRef: string;
  readonly timestamp: string;
  readonly summary: ComparisonSummary;
  readonly files: FileComparison[];
}

/**
 * Optimization suggestion for reducing token count.
 */
export interface Suggestion {
  readonly line: number;
  readonly issue: string;
  readonly suggestion: string;
  readonly estimatedSavings: number;
}

export interface FileAnalysis {
  readonly file: string;
  readonly tokens: number;
  readonly characters: number;
  readonly lines: number;
  readonly suggestions: Suggestion[];
  readonly potentialSavings: number;
}

/** Characters per token approximation */
const CHARS_PER_TOKEN = 4;

/** Maximum buffer size for git operations (10MB) */
export const MAX_GIT_BUFFER_SIZE = 10 * 1024 * 1024;

/** Timeout for git operations in milliseconds */
export const GIT_OPERATION_TIMEOUT = 30000;

/** Suggestion thresholds */
export const MAX_DECORATIVE_EMOJIS = 2;
export const LARGE_CODE_BLOCK_LINES = 10;
export const LARGE_TABLE_ROWS = 10;
export const TOKENS_PER_EMOJI = 2;
export const TOKENS_PER_CODE_LINE = 16;
export const TOKENS_PER_TABLE_ROW = 12;

/** Common directories to exclude from scanning */
export const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'coverage'] as const;

/** Default directories to scan for skills/agents */
export const DEFAULT_SCAN_DIRS = ['.github/skills', 'plugin/skills', '.github/agents'] as const;

/** Supported markdown extensions */
export const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

/** Default token limits configuration */
export const DEFAULT_LIMITS: TokenLimitsConfig = {
  defaults: {
    'SKILL.md': 500,
    'references/**/*.md': 1000,
    'docs/**/*.md': 1500,
    '**/*.md': 2000
  },
  overrides: {
    'README.md': 3000,
    'CONTRIBUTING.md': 2500,
    'plugin/README.md': 3000
  }
};

/** Estimates token count (~4 chars/token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Checks if file has markdown extension */
export function isMarkdownFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(ext as typeof MARKDOWN_EXTENSIONS[number]);
}

/** Normalizes path separators to forward slashes */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/** Checks if file path matches a glob pattern */
export function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizePath(filePath);

  if (!pattern.includes('/') && !pattern.includes('*')) {
    return normalizedPath.endsWith('/' + pattern) || normalizedPath === pattern;
  }

  return micromatch.isMatch(normalizedPath, pattern);
}

/**
 * Safely extracts error message from unknown error types.
 * Handles Error instances, strings, and other types.
 * @param error - Unknown error object
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
