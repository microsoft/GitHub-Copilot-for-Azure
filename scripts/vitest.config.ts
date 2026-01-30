import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,  // Run test files sequentially to avoid race conditions on Windows
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
