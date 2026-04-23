import { assertCount, generateFlakinessReport } from './utils.js';

it('should embed source snippets for files referenced by any Location', async () => {
  const { report } = await generateFlakinessReport('sources - error location', {
    'a.test.js': `
test('fails', () => {
  throw new Error('bang');
});
`,
  });
  // Error location points into a.test.js, so its source should be embedded.
  const [source] = assertCount(report.sources, 1);
  expect(source.filePath).toBe('a.test.js');
  expect(source.text).toContain("throw new Error('bang')");
});

it('should not embed sources when no Location is referenced', async () => {
  const { report } = await generateFlakinessReport('sources - no location', {
    'a.test.js': `test('ok', () => {});`,
  });
  // No errors, no test.location (testLocationInResults not enabled by default) → no referenced files.
  expect(report.sources ?? []).toEqual([]);
});
