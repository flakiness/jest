import { generateFlakinessReport } from './utils.js';

it('should honor FLAKINESS_TITLE env var', async () => {
  const { report } = await generateFlakinessReport('envvars - title', {
    'a.test.js': `test('noop', () => {});`,
  }, {
    env: { FLAKINESS_TITLE: 'nightly run' },
  });
  expect(report.title).toBe('nightly run');
});

it('should let reporter option override FLAKINESS_TITLE', async () => {
  const { report } = await generateFlakinessReport('envvars - title option wins', {
    'a.test.js': `test('noop', () => {});`,
  }, {
    reporterOptions: { title: 'from-option' },
    env: { FLAKINESS_TITLE: 'from-env' },
  });
  expect(report.title).toBe('from-option');
});
