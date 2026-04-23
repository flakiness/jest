import { generateFlakinessReport } from './utils.js';

it('should report proper top-level properties', async () => {
  const starttime = Date.now();
  const { report, cmd } = await generateFlakinessReport('basic - top-level properties', {
    'sum.test.js': `
      test('should work', async () => {
        expect(1 + 1).toBe(2);
        await new Promise(r => setTimeout(r, 50));
      });
    `,
  }, {
    reporterOptions: { flakinessProject: 'foo/bar' },
  });

  expect(report.category).toBe('jest');
  expect(report.flakinessProject).toBe('foo/bar');
  expect(report.commitId).not.toBeUndefined();
  expect(report.duration).toBeGreaterThan(50);
  expect(report.startTimestamp).toBeGreaterThanOrEqual(starttime);

  // Jest ran the sandbox tests successfully.
  expect(cmd.status).toBe(0);

  // A message on how to show the flakiness report should be shown.
  expect(cmd.stdout + cmd.stderr).toContain('flakiness show');
});
