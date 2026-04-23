import { assertCount, generateFlakinessReport } from './utils.js';

it('should emit a single attempt when no retries are configured', async () => {
  const { report } = await generateFlakinessReport('retries - no retry', {
    'a.test.js': `
      test('fails once', () => { throw new Error('boom'); });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.status).toBe('failed');
});

it('should synthesize N attempts when a test is retried (no retry error details)', async () => {
  const { report } = await generateFlakinessReport('retries - all fail default', {
    'a.test.js': `
      jest.retryTimes(2);
      test('always fails', () => { throw new Error('boom'); });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const attempts = assertCount(test.attempts, 3);
  // Without logErrorsBeforeRetry, Jest drops prior errors — only the last attempt has details.
  expect(attempts[0].errors ?? []).toEqual([]);
  expect(attempts[1].errors ?? []).toEqual([]);
  expect(attempts[2].errors?.[0].message).toBe('boom');
  for (const a of attempts)
    expect(a.status).toBe('failed');
});

it('should capture per-retry error details when logErrorsBeforeRetry is enabled', async () => {
  const { report } = await generateFlakinessReport('retries - with details', {
    'a.test.js': `
      jest.retryTimes(2, { logErrorsBeforeRetry: true });
      let count = 0;
      test('changes error', () => {
        count++;
        throw new Error('try-' + count);
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const attempts = assertCount(test.attempts, 3);
  expect(attempts[0].errors?.[0].message).toBe('try-1');
  expect(attempts[1].errors?.[0].message).toBe('try-2');
  expect(attempts[2].errors?.[0].message).toBe('try-3');
});

it('should emit failed attempts then a passed attempt for a flaky test', async () => {
  const { report } = await generateFlakinessReport('retries - eventually passes', {
    'a.test.js': `
      jest.retryTimes(3, { logErrorsBeforeRetry: true });
      let count = 0;
      test('flaky', () => {
        count++;
        if (count < 3) throw new Error('attempt-' + count);
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const attempts = assertCount(test.attempts, 3);

  expect(attempts[0].status).toBe('failed');
  expect(attempts[0].errors?.[0].message).toBe('attempt-1');

  expect(attempts[1].status).toBe('failed');
  expect(attempts[1].errors?.[0].message).toBe('attempt-2');

  expect(attempts[2].status ?? 'passed').toBe('passed');
  expect(attempts[2].errors ?? []).toEqual([]);
});
