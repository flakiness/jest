import { assertCount, generateFlakinessReport } from './utils.js';

// `test.skip` / `describe.skip` / `xtest` all surface as Circus status `'pending'`.
// (The `'skipped'` / `'disabled'` literals in @jest/types are Jasmine-era and never emitted today.)
it('should emit a "skip" annotation for test.skip', async () => {
  const { report } = await generateFlakinessReport('annotations - skip', {
    'a.test.js': `test.skip('skipped', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const [annotation] = assertCount(attempt.annotations, 1);
  expect(annotation.type).toBe('skip');
});

it('should emit a "skip" annotation for describe.skip children', async () => {
  const { report } = await generateFlakinessReport('annotations - describe skip', {
    'a.test.js': `
      describe.skip('suite', () => {
        test('inner', () => {});
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [suite] = assertCount(fileSuite.suites, 1);
  const [test] = assertCount(suite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const [annotation] = assertCount(attempt.annotations, 1);
  expect(annotation.type).toBe('skip');
});

it('should emit a "fixme" annotation for test.todo', async () => {
  const { report } = await generateFlakinessReport('annotations - todo', {
    'a.test.js': `test.todo('not yet');`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const [annotation] = assertCount(attempt.annotations, 1);
  expect(annotation.type).toBe('fixme');
});

it('should emit a "fail" annotation for test.failing', async () => {
  const { report } = await generateFlakinessReport('annotations - failing', {
    'a.test.js': `
      test.failing('known broken', () => {
        throw new Error('boom');
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  const [annotation] = assertCount(attempt.annotations, 1);
  expect(annotation.type).toBe('fail');
});

it('should not emit annotations for a plain passing test', async () => {
  const { report } = await generateFlakinessReport('annotations - plain', {
    'a.test.js': `test('ok', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  const [attempt] = assertCount(test.attempts, 1);
  expect(attempt.annotations ?? []).toEqual([]);
});
