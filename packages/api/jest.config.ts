import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.', // fixes default src -> resolves __tests__ dir outside src
  testMatch: [
    '<rootDir>/__tests__/**/*.spec.ts',          // unit + integrity top-level
    '<rootDir>/__tests__/integ/**/*.spec.ts',    // integ subfolder
    '<rootDir>/__tests__/integrity/**/*.spec.ts' // integrity subfolder
  ],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // ESM shims that are CLI-only uncommitted _shims files — still referenced so test works locally
    '@nestjs/event-emitter': '<rootDir>/__tests__/_shims_nestjs_event_emitter.cjs',
    '@nestjs/schedule': '<rootDir>/__tests__/_shims_nestjs_schedule.cjs',
  },
  testTimeout: 120000,
  forceExit: true,
  detectOpenHandles: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
  verbose: true,
};

export default config;
