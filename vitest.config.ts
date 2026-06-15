import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Phase 1 checkpoint runs with zero test files; the suite grows under TDD.
    passWithNoTests: true,
    // The lint performance test (SC-007) is heavy; it self-gates on RUN_SLOW
    // (see tests/integration/perf-lint.test.ts) so the default run stays fast.
  },
});
