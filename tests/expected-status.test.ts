import { assertCount, generateFlakinessReport } from './utils.js';

it('should support test.failing', async () => {
  const { report } = await generateFlakinessReport('expected - failing actually fails', {
    'a.test.js': `
      test.failing('known-broken', () => {
        expect(1).toBe(2);
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  // Declared intent: expected to fail. Body threw → actual status also 'failed'. Match → no alert.
  expect(attempt.expectedStatus).toBe('failed');
  expect(attempt.status).toBe('failed');
});

it('should surface a surprise pass on test.failing as a mismatch', async () => {
  const { report } = await generateFlakinessReport('expected - failing passes unexpectedly', {
    'a.test.js': `
      test.failing('surprise pass', () => {
        expect(1).toBe(1);
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  // Declared intent: expected to fail. Body passed → actual status 'passed'. Mismatch → alerted.
  expect(attempt.expectedStatus).toBe('failed');
  expect(attempt.status ?? 'passed').toBe('passed');
});

it('should combine retries with test.failing expectations', async () => {
  const { report } = await generateFlakinessReport('expected - failing + retries', {
    'a.test.js': `
      jest.retryTimes(3);
      let count = 0;
      test.failing('flaky expected-failure', () => {
        count++;
        // First two invocations: body surprise-passes (doesn't throw) → Jest retries.
        // Third invocation: body throws — the expected outcome, no more retries.
        if (count < 3) return;
        throw new Error('finally threw');
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const attempts = assertCount(test.attempts, 3);

  // First two: body passed unexpectedly → mismatch with expectedStatus='failed'.
  for (const a of attempts.slice(0, 2)) {
    expect(a.expectedStatus).toBe('failed');
    expect(a.status ?? 'passed').toBe('passed');
  }
  // Final: body threw as expected → match.
  expect(attempts[2].expectedStatus).toBe('failed');
  expect(attempts[2].status).toBe('failed');
});

