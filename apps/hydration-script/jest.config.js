module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['text', 'html'],
  testMatch: ["**/*.test.ts"]
};
