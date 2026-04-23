import { assertCount, generateFlakinessReport } from './utils.js';

it('should populate test location', async () => {
  const { report } = await generateFlakinessReport('location - test', {
    'a.test.js': `
      test('first', () => {});

test('second', () => {});
    `,
  }, {
    jestConfig: { testLocationInResults: true },
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const tests = assertCount(fileSuite.tests, 2);
  const byTitle = Object.fromEntries(tests.map(t => [t.title, t]));

  expect(byTitle['first'].location?.file).toBe('a.test.js');
  expect(byTitle['first'].location?.line).toBe(2);
  expect(byTitle['first'].location?.column).toBe(7);

  expect(byTitle['second'].location?.file).toBe('a.test.js');
  expect(byTitle['second'].location?.line).toBe(4);
  expect(byTitle['second'].location?.column).toBe(1);
});
