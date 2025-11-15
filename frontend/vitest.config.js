import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov', 'html', 'json'],
    exclude: [
      'node_modules/',
      'src/setupTests.js',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**',
    ],
  },
})
