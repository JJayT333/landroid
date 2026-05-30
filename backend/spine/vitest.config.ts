import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/spine/src/**/*.test.ts'],
  },
});
