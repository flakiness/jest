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

it('should not crash when weird error gets reported', async () => {
  // jest <30 serializes worker results as JSON, and an Error's `message`/`stack` are
  // non-enumerable, so failureDetails[i] arrives at the reporter as a bare `{}` with
  // `message: undefined` — while failureMessages[i] survives as a pre-formatted string.
  // The reporter used to call ReportUtils.stripAnsi(detail.message) and crash in
  // onRunComplete with "Cannot read properties of undefined (reading 'replace')",
  // aborting the whole report. We emulate that shape here: read `.stack` so it keeps
  // the message, then drop `.message` (failureDetails hole) while the stack string
  // (failureMessages) stays intact.
  const { report, cmd } = await generateFlakinessReport('errors - serialized detail', {
    'a.test.js': `
      test('boom', () => {
        const e = new Error('serialized-error-message');
        void e.stack;          // force V8 to format the stack with the message
        e.message = undefined;  // failureDetails[i].message is now a hole
        throw e;
      });
    `,
  });
  // The reporter must not crash: a report is still produced for the failed test.
  expect(cmd.stderr).not.toContain("reading 'replace'");
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.status).toBe('failed');
  const [error] = assertCount(attempt.errors, 1);
  // `detail.message` was the hole, so `message` is left unset, but the surviving
  // stack string still carries the error text and location.
  expect(error.message).toBeUndefined();
  expect(error.stack).toContain('serialized-error-message');
  expect(error.stack).toContain('a.test.js');
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
