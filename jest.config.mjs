/** @type {import('jest').Config} */
export default {
  reporters: [
    'default',
    ['@flakiness/jest', {
      flakinessProject: 'flakiness/jest',
    }],
  ],
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  extensionsToTreatAsEsm: ['.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }],
  },
};
