import { assertCount, generateFlakinessReport } from './utils.js';

it('should collapse duplicate tests into one failing test by default', async () => {
  const { report, cmd } = await generateFlakinessReport('duplicates - fail mode', {
    'a.test.js': `
      test('same name', () => {});
      test('same name', () => {});
      test('same name', () => {});
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);

  // Default 'fail' mode: duplicates collapse into one failing test;
  // the others are stripped of attempts and pruned by normalizeReport.
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.status).toBe('failed');
  expect(attempt.errors?.[0].message).toContain('3 tests with identical full name');
  expect(attempt.annotations?.[0].type).toBe('dupe');

  // Reporter should have warned about duplicates.
  expect(cmd.stdout + cmd.stderr).toContain('duplicate full names');
});

it('should rename duplicates with " – dupe #N" when duplicates=rename', async () => {
  const { report } = await generateFlakinessReport('duplicates - rename mode', {
    'a.test.js': `
      test('same name', () => {});
      test('same name', () => {});
      test('same name', () => {});
    `,
  }, {
    reporterOptions: { duplicates: 'rename' },
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const tests = assertCount(fileSuite.tests, 3);
  const titles = tests.map(t => t.title);
  expect(titles).toEqual(['same name', 'same name – dupe #2', 'same name – dupe #3']);

  // First keeps no dupe annotation; renamed ones get one.
  expect(tests[0].attempts[0].annotations ?? []).toEqual([]);
  expect(tests[1].attempts[0].annotations?.[0].type).toBe('dupe');
  expect(tests[2].attempts[0].annotations?.[0].type).toBe('dupe');
});

it('should flag tests that only differed by trailing @tags as duplicates', async () => {
  const { report, cmd } = await generateFlakinessReport('duplicates - tag-stripped', {
    'a.test.js': `
      test('checkout @smoke', () => {});
      test('checkout @regression', () => {});
    `,
  });
  // Both titles strip to 'checkout' → same full name → duplicates, collapsed in 'fail' mode.
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  expect(test.title).toBe('checkout');
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.status).toBe('failed');
  expect(attempt.errors?.[0].message).toContain('2 tests with identical full name');
  expect(cmd.stdout + cmd.stderr).toContain('duplicate full names');
});

it('should not flag same-name tests across different environments as duplicates', async () => {
  const { report } = await generateFlakinessReport('duplicates - cross-env', {
    'projects/alpha/a.test.js': `test('shared', () => {});`,
    'projects/beta/b.test.js':  `test('shared', () => {});`,
  }, {
    jestConfig: {
      projects: [
        { displayName: 'alpha', rootDir: './projects/alpha' },
        { displayName: 'beta',  rootDir: './projects/beta'  },
      ],
    },
  });
  // Two fileSuites, one per env. Each has one 'shared' test. Since they're in different
  // environments, they aren't duplicates — both keep their original titles and attempts.
  const fileSuites = assertCount(report.suites, 2);
  for (const fs of fileSuites) {
    const [test] = assertCount(fs.tests, 1);
    expect(test.title).toBe('shared');
    expect(test.attempts).toHaveLength(1);
  }
});
