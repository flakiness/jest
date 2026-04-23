import { assertCount, generateFlakinessReport } from './utils.js';

it('should emit a flat test structure', async () => {
  const { report } = await generateFlakinessReport('hierarchy - flat', {
    'a.test.js': `
      test('one', () => {});
      test('two', () => {});
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  expect(fileSuite.type).toBe('file');
  expect(fileSuite.title).toBe('a.test.js');
  const tests = assertCount(fileSuite.tests, 2);
  expect(tests.map(t => t.title).sort()).toEqual(['one', 'two']);
  expect(fileSuite.suites).toBeUndefined();
});

it('should nest describes', async () => {
  const { report } = await generateFlakinessReport('hierarchy - describes', {
    'a.test.js': `
      describe('outer', () => {
        describe('inner', () => {
          test('deep', () => {});
        });
        test('middle', () => {});
      });
      test('top', () => {});
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  expect(fileSuite.type).toBe('file');

  // Top-level test lives directly on the file suite.
  const [topTest] = assertCount(fileSuite.tests, 1);
  expect(topTest.title).toBe('top');

  // 'outer' describe is a child suite of the file.
  const [outer] = assertCount(fileSuite.suites, 1);
  expect(outer.type).toBe('suite');
  expect(outer.title).toBe('outer');
  const [middleTest] = assertCount(outer.tests, 1);
  expect(middleTest.title).toBe('middle');

  // 'inner' describe is nested inside 'outer'.
  const [inner] = assertCount(outer.suites, 1);
  expect(inner.type).toBe('suite');
  expect(inner.title).toBe('inner');
  const [deepTest] = assertCount(inner.tests, 1);
  expect(deepTest.title).toBe('deep');
});

it('should emit one file suite per test file', async () => {
  const { report } = await generateFlakinessReport('hierarchy - multi-file', {
    'a.test.js': `test('a', () => {});`,
    'b.test.js': `test('b', () => {});`,
  });
  const fileSuites = assertCount(report.suites, 2);
  expect(fileSuites.map(s => s.title).sort()).toEqual(['a.test.js', 'b.test.js']);
  for (const s of fileSuites)
    expect(s.type).toBe('file');
});

it('should map passed/failed/skipped/todo statuses', async () => {
  const { report } = await generateFlakinessReport('hierarchy - statuses', {
    'a.test.js': `
      test('pass', () => {});
      test('fail', () => { throw new Error('boom'); });
      test.skip('skip', () => {});
      test.todo('todo');
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const tests = assertCount(fileSuite.tests, 4);
  const byTitle = Object.fromEntries(tests.map(t => [t.title, t]));
  expect(byTitle['pass'].attempts[0].status ?? 'passed').toBe('passed');
  expect(byTitle['fail'].attempts[0].status).toBe('failed');
  expect(byTitle['skip'].attempts[0].status).toBe('skipped');
  expect(byTitle['todo'].attempts[0].status).toBe('skipped');
});

it('should record per-attempt duration and startTimestamp', async () => {
  const starttime = Date.now();
  const { report } = await generateFlakinessReport('hierarchy - timing', {
    'a.test.js': `
      test('slow', async () => {
        await new Promise(r => setTimeout(r, 50));
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.duration).toBeGreaterThanOrEqual(50);
  expect(attempt.startTimestamp).toBeGreaterThanOrEqual(starttime);
});
