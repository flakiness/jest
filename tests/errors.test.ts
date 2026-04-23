import { assertCount, generateFlakinessReport } from './utils.js';

it('should capture a thrown Error', async () => {
  const { report } = await generateFlakinessReport('errors - thrown', {
    'a.test.js': `
      test('boom', () => {
        throw new Error('my-error');
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.status).toBe('failed');
  const [error] = assertCount(attempt.errors, 1);
  expect(error.message).toBe('my-error');
  expect(error.stack).toContain('a.test.js');
});

it('should capture an expect() failure', async () => {
  const { report } = await generateFlakinessReport('errors - expect', {
    'a.test.js': `
      test('mismatch', () => {
        expect(1).toBe(2);
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.status).toBe('failed');
  const [error] = assertCount(attempt.errors, 1);
  expect(error.message).toContain('expect(received).toBe(expected)');
  expect(error.stack).toContain('a.test.js');
});

it('should capture error location inside the test file', async () => {
  const { report } = await generateFlakinessReport('errors - location', {
    'a.test.js': `
test('at line 2', () => {
  throw new Error('bang');
});
`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const [error] = assertCount(attempt.errors, 1);
  expect(error.location?.file).toBe('a.test.js');
  expect(error.location?.line).toBe(3);
});

it('should handle non-Error throws', async () => {
  const { report } = await generateFlakinessReport('errors - non-error throw', {
    'a.test.js': `
      test('throws string', () => {
        throw 'bare-string';
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const [error] = assertCount(attempt.errors, 1);
  // Jest wraps non-Error throws as `thrown: <formatted>`; we surface that as-is.
  expect(error.message).toContain('bare-string');
});

it('should surface multiple errors when a hook also throws', async () => {
  const { report } = await generateFlakinessReport('errors - hook propagation', {
    'a.test.js': `
      afterEach(() => { throw new Error('hook-error'); });
      test('body', () => { throw new Error('test-error'); });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const errors = assertCount(attempt.errors, 2);
  const messages = errors.map(e => e.message);
  expect(messages).toContain('test-error');
  expect(messages).toContain('hook-error');
});

it('should not attach errors to a passing test', async () => {
  const { report } = await generateFlakinessReport('errors - passing test', {
    'a.test.js': `test('ok', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.errors).toBeUndefined();
});
