/**
 * Shared types and utilities for token management
 */

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

export interface TokenLimitsConfig {
  readonly defaults: Record<string, number>;
  readonly overrides: Record<string, number>;
}

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

/** Common directories to exclude from scanning */
export const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'coverage'] as const;

/** Default directories to scan for skills/agents */
export const DEFAULT_SCAN_DIRS = ['.github/skills', 'plugin/skills', '.github/agents'] as const;

/** Supported markdown extensions */
export const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

/** Estimates token count (~4 chars/token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Checks if file has markdown extension */
export function isMarkdownFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(ext as typeof MARKDOWN_EXTENSIONS[number]);
}

/** Normalizes path separators to forward slashes */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
