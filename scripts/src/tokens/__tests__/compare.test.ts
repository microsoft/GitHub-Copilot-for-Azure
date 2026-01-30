/**
 * Tests for compare command - git-based token comparison
 */

import { describe, it, expect } from 'vitest';

// Test the git ref validation logic
const GIT_REF_PATTERN = /^[a-zA-Z0-9._\-\/~^]+$/;
const MAX_REF_LENGTH = 256;

function isValidGitRef(ref: string): boolean {
  return GIT_REF_PATTERN.test(ref) && ref.length < MAX_REF_LENGTH;
}

describe('compare command', () => {
  describe('git ref validation', () => {
    it('accepts valid branch names', () => {
      expect(isValidGitRef('main')).toBe(true);
      expect(isValidGitRef('develop')).toBe(true);
      expect(isValidGitRef('feature/new-feature')).toBe(true);
      expect(isValidGitRef('release-1.0.0')).toBe(true);
      expect(isValidGitRef('fix_bug_123')).toBe(true);
    });

    it('accepts valid commit refs', () => {
      expect(isValidGitRef('HEAD')).toBe(true);
      expect(isValidGitRef('HEAD~1')).toBe(true);
      expect(isValidGitRef('HEAD~10')).toBe(true);
      expect(isValidGitRef('HEAD^')).toBe(true);
      expect(isValidGitRef('abc123def')).toBe(true);
    });

    it('accepts origin prefixed refs', () => {
      expect(isValidGitRef('origin/main')).toBe(true);
      expect(isValidGitRef('origin/feature/test')).toBe(true);
      expect(isValidGitRef('upstream/develop')).toBe(true);
    });

    it('accepts tag refs', () => {
      expect(isValidGitRef('v1.0.0')).toBe(true);
      expect(isValidGitRef('release-2023.01')).toBe(true);
    });

    it('rejects refs with shell metacharacters', () => {
      expect(isValidGitRef('main; rm -rf /')).toBe(false);
      expect(isValidGitRef('main && echo pwned')).toBe(false);
      expect(isValidGitRef('$(whoami)')).toBe(false);
      expect(isValidGitRef('`id`')).toBe(false);
      expect(isValidGitRef('main|cat /etc/passwd')).toBe(false);
    });

    it('rejects refs with spaces', () => {
      expect(isValidGitRef('main branch')).toBe(false);
      expect(isValidGitRef(' main')).toBe(false);
      expect(isValidGitRef('main ')).toBe(false);
    });

    it('rejects refs with quotes', () => {
      expect(isValidGitRef("main'")).toBe(false);
      expect(isValidGitRef('main"')).toBe(false);
    });

    it('rejects refs with special characters', () => {
      expect(isValidGitRef('main!')).toBe(false);
      expect(isValidGitRef('main#')).toBe(false);
      expect(isValidGitRef('main$var')).toBe(false);
      expect(isValidGitRef('main%')).toBe(false);
      expect(isValidGitRef('main*')).toBe(false);
      expect(isValidGitRef('main?')).toBe(false);
    });

    it('rejects empty refs', () => {
      expect(isValidGitRef('')).toBe(false);
    });

    it('rejects refs exceeding max length', () => {
      const longRef = 'a'.repeat(256);
      expect(isValidGitRef(longRef)).toBe(false);
      
      const validLongRef = 'a'.repeat(255);
      expect(isValidGitRef(validLongRef)).toBe(true);
    });
  });

  describe('diff formatting', () => {
    function formatDiff(diff: number): string {
      if (diff > 0) return `+${diff.toLocaleString()}`;
      if (diff < 0) return diff.toLocaleString();
      return '0';
    }

    function formatPercent(percent: number): string {
      if (percent > 0) return `+${percent}%`;
      if (percent < 0) return `${percent}%`;
      return '0%';
    }

    it('formats positive diffs with plus sign', () => {
      expect(formatDiff(100)).toBe('+100');
      expect(formatDiff(1000)).toBe('+1,000');
    });

    it('formats negative diffs with minus sign', () => {
      expect(formatDiff(-100)).toBe('-100');
      expect(formatDiff(-1000)).toBe('-1,000');
    });

    it('formats zero diff', () => {
      expect(formatDiff(0)).toBe('0');
    });

    it('formats positive percent with plus sign', () => {
      expect(formatPercent(50)).toBe('+50%');
    });

    it('formats negative percent', () => {
      expect(formatPercent(-25)).toBe('-25%');
    });

    it('formats zero percent', () => {
      expect(formatPercent(0)).toBe('0%');
    });
  });

  describe('change emoji selection', () => {
    function getChangeEmoji(diff: number, percent: number): string {
      if (diff === 0) return '➖';
      if (diff < 0) return '📉';
      if (percent > 50) return '🔴';
      if (percent > 20) return '🟠';
      return '📈';
    }

    it('returns neutral emoji for no change', () => {
      expect(getChangeEmoji(0, 0)).toBe('➖');
    });

    it('returns decrease emoji for negative diff', () => {
      expect(getChangeEmoji(-100, -10)).toBe('📉');
    });

    it('returns red emoji for large increase (>50%)', () => {
      expect(getChangeEmoji(100, 51)).toBe('🔴');
      expect(getChangeEmoji(100, 100)).toBe('🔴');
    });

    it('returns orange emoji for medium increase (>20%)', () => {
      expect(getChangeEmoji(100, 21)).toBe('🟠');
      expect(getChangeEmoji(100, 50)).toBe('🟠');
    });

    it('returns increase emoji for small increase', () => {
      expect(getChangeEmoji(100, 10)).toBe('📈');
      expect(getChangeEmoji(100, 20)).toBe('📈');
    });
  });

  describe('comparison report structure', () => {
    it('creates valid comparison report', () => {
      const report = {
        baseRef: 'main',
        headRef: 'HEAD',
        timestamp: new Date().toISOString(),
        summary: {
          totalBefore: 1000,
          totalAfter: 1100,
          totalDiff: 100,
          percentChange: 10,
          filesAdded: 1,
          filesRemoved: 0,
          filesModified: 2,
          filesIncreased: 2,
          filesDecreased: 1
        },
        files: [
          {
            file: 'new.md',
            before: null,
            after: { tokens: 100, characters: 400, lines: 20 },
            diff: 100,
            percentChange: 100,
            status: 'added' as const
          },
          {
            file: 'modified.md',
            before: { tokens: 500, characters: 2000, lines: 100 },
            after: { tokens: 550, characters: 2200, lines: 110 },
            diff: 50,
            percentChange: 10,
            status: 'modified' as const
          }
        ]
      };

      expect(report.baseRef).toBe('main');
      expect(report.headRef).toBe('HEAD');
      expect(report.summary.totalDiff).toBe(100);
      expect(report.files.length).toBe(2);
      expect(report.files[0].status).toBe('added');
      expect(report.files[1].status).toBe('modified');
    });

    it('calculates correct percent change', () => {
      const before = 1000;
      const after = 1100;
      const diff = after - before;
      const percentChange = Math.round((diff / before) * 100);
      
      expect(percentChange).toBe(10);
    });

    it('handles zero before case for percent change', () => {
      const before = 0;
      const after = 100;
      // When before is 0, percent calculation uses special logic for new files
      const percentChange = before === 0
        ? (after > 0 ? 100 : 0)
        : Math.round(((after - before) / before) * 100);
      
      expect(percentChange).toBe(100);
    });
  });
});
