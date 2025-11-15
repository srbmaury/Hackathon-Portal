const { defineConfig } = require('vitest/config');
const fs = require('fs');
const path = require('path');

// Ensure coverage directories exist
const coverageDir = path.join(__dirname, 'coverage');
const tmpDir = path.join(coverageDir, '.tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/*.test.js'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules/', 'test/fixtures/'],
      reportsDirectory: './coverage',
    },
  },
});
