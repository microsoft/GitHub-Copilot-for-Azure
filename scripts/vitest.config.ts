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
      ],
      thresholds: {
        statements: 80,
        branches: 66,  // Baseline: 66.35% (cli.ts entry point not covered)
        functions: 97,
        lines: 80
      }
    }
  }
});
