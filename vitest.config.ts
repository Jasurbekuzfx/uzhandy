import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      WEB_APP_URL: 'http://localhost:5173',
    },
    include: ['server/**/*.test.ts', 'web/**/*.test.{ts,tsx}'],
  },
});
