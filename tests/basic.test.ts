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

  // Environment metadata (feature #2).
  expect(report.environments).toHaveLength(1);
  const env = report.environments[0];
  expect(env.name).toBe('jest');
  expect(env.systemData?.osName).toBeDefined();
  expect(env.systemData?.osVersion).toBeDefined();
  expect(env.systemData?.osArch).toBeDefined();

  // CPU / RAM telemetry (feature #24).
  expect(report.cpuCount).toBeGreaterThan(0);
  expect(report.cpuAvg?.length ?? 0).toBeGreaterThan(0);
  expect(report.cpuMax?.length ?? 0).toBeGreaterThan(0);
  expect(report.ramBytes).toBeGreaterThan(0);
  expect(report.ram?.length ?? 0).toBeGreaterThan(0);

  // Jest ran the sandbox tests successfully.
  expect(cmd.status).toBe(0);

  // A message on how to show the flakiness report should be shown.
  expect(cmd.stdout + cmd.stderr).toContain('flakiness show');
});
