import { assertCount, generateFlakinessReport } from './utils.js';

it('should emit one environment per Jest project', async () => {
  const { report } = await generateFlakinessReport('projects - two projects', {
    'projects/alpha/a.test.js': `test('alpha test', () => {});`,
    'projects/beta/b.test.js':  `test('beta test',  () => {});`,
  }, {
    jestConfig: {
      projects: [
        { displayName: 'alpha', rootDir: './projects/alpha' },
        { displayName: 'beta',  rootDir: './projects/beta'  },
      ],
    },
  });

  // Two environments — one per displayName, in the order files were processed.
  const envs = assertCount(report.environments, 2);
  expect(envs.map(e => e.name).sort()).toEqual(['alpha', 'beta']);

  // Each attempt points at the environment matching its project.
  const flatTests: Array<{ title: string; envIdx: number | undefined }> = [];
  const walk = (suites: typeof report.suites) => {
    for (const s of suites ?? []) {
      for (const t of s.tests ?? [])
        flatTests.push({ title: t.title, envIdx: t.attempts[0].environmentIdx });
      if (s.suites) walk(s.suites);
    }
  };
  walk(report.suites);

  const alphaIdx = envs.findIndex(e => e.name === 'alpha');
  const betaIdx  = envs.findIndex(e => e.name === 'beta');
  const byTitle = Object.fromEntries(flatTests.map(t => [t.title, t.envIdx ?? 0]));
  expect(byTitle['alpha test']).toBe(alphaIdx);
  expect(byTitle['beta test']).toBe(betaIdx);
});

it('should give unique names to projects sharing a displayName', async () => {
  const { report } = await generateFlakinessReport('projects - collision', {
    'projects/v1/a.test.js': `test('v1 test', () => {});`,
    'projects/v2/b.test.js': `test('v2 test', () => {});`,
  }, {
    jestConfig: {
      projects: [
        { displayName: 'api', rootDir: './projects/v1' },
        { displayName: 'api', rootDir: './projects/v2' },
      ],
    },
  });

  // Two distinct environments despite shared displayName.
  const envs = assertCount(report.environments, 2);
  expect(envs.map(e => e.name).sort()).toEqual(['api', 'api (2)']);
});

it('should default to a single "jest" environment when no projects are configured', async () => {
  const { report } = await generateFlakinessReport('projects - single', {
    'a.test.js': `test('ok', () => {});`,
  });
  const [env] = assertCount(report.environments, 1);
  expect(env.name).toBe('jest');
});
