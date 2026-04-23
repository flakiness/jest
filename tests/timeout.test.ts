import { assertCount, generateFlakinessReport } from './utils.js';

it('should emit the global testTimeout on each attempt', async () => {
  const { report } = await generateFlakinessReport('timeout - custom', {
    'a.test.js': `test('ok', () => {});`,
  }, {
    jestConfig: { testTimeout: 12345 },
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.timeout).toBe(12345);
});

it('should default to Jest 5000ms when testTimeout is not configured', async () => {
  const { report } = await generateFlakinessReport('timeout - default', {
    'a.test.js': `test('ok', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.timeout).toBe(5000);
});
