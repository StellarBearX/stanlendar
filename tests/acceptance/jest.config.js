module.exports = {
  displayName: 'Acceptance Tests',
  testMatch: ['<rootDir>/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 60000, // 60 seconds for acceptance tests
  verbose: true,
  collectCoverage: false, // Acceptance tests don't need coverage
};