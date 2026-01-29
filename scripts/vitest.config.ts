import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**'
      ]
      // Coverage tracking enabled, no enforcement thresholds
      // Current baseline: ~2% (only types.ts utility functions)
      // TODO: Add integration tests for command functions to increase coverage
    }
  }
});
