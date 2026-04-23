import { assertCount, generateFlakinessReport } from './utils.js';

it('should surface a file-level import error as an unattributedError', async () => {
  const { report } = await generateFlakinessReport('unattributed - import failure', {
    'a.test.js': `
      require('./does-not-exist-module');
      test('never runs', () => {});
    `,
  });
  const [error] = assertCount(report.unattributedErrors, 1);
  expect(error.message).toContain('Cannot find module');
  expect(error.stack).toContain('does-not-exist-module');
});

it('should not emit unattributedErrors for a healthy run', async () => {
  const { report } = await generateFlakinessReport('unattributed - healthy', {
    'a.test.js': `test('ok', () => {});`,
  });
  expect(report.unattributedErrors ?? []).toEqual([]);
});
