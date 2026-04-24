import { assertCount, generateFlakinessReport } from './utils.js';

it('should extract @tags from the test title and strip them from the title', async () => {
  const { report } = await generateFlakinessReport('tags - title', {
    'a.test.js': `test('checkout @smoke @regression', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  expect(test.tags?.sort()).toEqual(['regression', 'smoke']);
  expect(test.title).toBe('checkout');
});

it('should inherit @tags from describe chain without stripping the suite title', async () => {
  const { report } = await generateFlakinessReport('tags - describe', {
    'a.test.js': `
      describe('api stuff @api @v2', () => {
        test('login', () => {});
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [suite] = assertCount(fileSuite.suites, 1);
  // Suite title stays verbatim — only tests strip their trailing tags.
  expect(suite.title).toBe('api stuff @api @v2');
  const [test] = assertCount(suite.tests, 1);
  expect(test.tags?.sort()).toEqual(['api', 'v2']);
});

it('should treat a pure-tag test title as not-a-tagging situation', async () => {
  const { report } = await generateFlakinessReport('tags - pure-tag title', {
    'a.test.js': `
      describe('@api', () => {
        test('@smoke', () => {});
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [suite] = assertCount(fileSuite.suites, 1);
  // Suite title untouched; inherits '@api' as a tag.
  expect(suite.title).toBe('@api');
  const [test] = assertCount(suite.tests, 1);
  // Test title is just '@smoke' with no other content → not considered tagged.
  expect(test.title).toBe('@smoke');
  // Only the inherited 'api' tag — 'smoke' was NOT extracted because the test title would collapse.
  expect(test.tags).toEqual(['api']);
});

it('should dedupe tags that appear in both describe and test', async () => {
  const { report } = await generateFlakinessReport('tags - dedupe', {
    'a.test.js': `
      describe('@api', () => {
        test('checkout @api @smoke', () => {});
      });
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [suite] = assertCount(fileSuite.suites, 1);
  const [test] = assertCount(suite.tests, 1);
  expect(test.tags?.sort()).toEqual(['api', 'smoke']);
  // Test title stripped of trailing tags.
  expect(test.title).toBe('checkout');
});

it('should only recognize trailing tags, not mid-title', async () => {
  const { report } = await generateFlakinessReport('tags - trailing only', {
    'a.test.js': `
      test('checkout @bogus happens on mobile @smoke', () => {});
    `,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  // Only '@smoke' is a trailing tag; '@bogus' is mid-title and ignored.
  expect(test.tags).toEqual(['smoke']);
  // Only the trailing '@smoke' is stripped; '@bogus' stays in the title as-is.
  expect(test.title).toBe('checkout @bogus happens on mobile');
});

it('should not treat email-style @ as a tag', async () => {
  const { report } = await generateFlakinessReport('tags - email', {
    'a.test.js': `test('ping alice@example.com', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  expect(test.tags ?? []).toEqual([]);
  // Title untouched — no trailing @tag to strip.
  expect(test.title).toBe('ping alice@example.com');
});

it('should leave tests without @tags untagged', async () => {
  const { report } = await generateFlakinessReport('tags - untagged', {
    'a.test.js': `test('plain', () => {});`,
  });
  const [fileSuite] = assertCount(report.suites, 1);
  const [test] = assertCount(fileSuite.tests, 1);
  expect(test.tags).toBeUndefined();
  expect(test.title).toBe('plain');
});
