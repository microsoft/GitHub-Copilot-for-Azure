/**
 * Integration tests for CLI - command routing
 */

import { describe, it, expect } from 'vitest';

describe('CLI integration', () => {
  it('imports successfully', async () => {
    // Verify all commands can be imported
    const { count } = await import('../../commands/count.js');
    const { check } = await import('../../commands/check.js');
    const { suggest } = await import('../../commands/suggest.js');
    const { compare } = await import('../../commands/compare.js');
    
    expect(count).toBeDefined();
    expect(check).toBeDefined();
    expect(suggest).toBeDefined();
    expect(compare).toBeDefined();
  });
});
