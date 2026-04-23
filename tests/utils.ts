import type { FlakinessReport } from '@flakiness/flakiness-report';
import { readReport, ReportUtils } from '@flakiness/sdk';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FKJestReporterOptions } from '../src/reporter.js';

export const ARTIFACTS_DIR = process.platform === 'darwin'
  ? '/private/tmp/flakiness-jest'
  : '/tmp/flakiness-jest';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const JEST_BIN = path.join(PROJECT_ROOT, 'node_modules', 'jest', 'bin', 'jest.js');
const REPORTER_PATH = path.join(PROJECT_ROOT, 'lib', 'reporter.js');
const NODE_MODULES_PATH = path.join(PROJECT_ROOT, 'node_modules');

const CLEARED_CI_ENV: Record<string, undefined> = {
  BUILD_BUILDID: undefined,
  BUILD_URL: undefined,
  CI: undefined,
  CI_JOB_URL: undefined,
  GITHUB_REPOSITORY: undefined,
  GITHUB_RUN_ATTEMPT: undefined,
  GITHUB_RUN_ID: undefined,
  GITHUB_SERVER_URL: undefined,
  SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: undefined,
  SYSTEM_TEAMPROJECT: undefined,
};

const DEFAULT_FILES: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'sample-jest-project', version: '1.0.0' }, null, 2),
};

export type GenerateOptions = {
  reporterOptions?: FKJestReporterOptions;
  jestConfig?: Record<string, unknown>;
  args?: string[];
  env?: Record<string, string | undefined>;
};

export type GenerateFlakinessReportResult = {
  report: FlakinessReport.Report;
  attachments: ReportUtils.FileAttachment[];
  missingAttachments: FlakinessReport.Attachment[];
  cmd: { stdout: string; stderr: string; status: number };
};

export async function generateFlakinessReport(
  name: string,
  files: Record<string, string>,
  options: GenerateOptions = {},
): Promise<GenerateFlakinessReportResult> {
  const targetDir = path.join(ARTIFACTS_DIR, slugify(name));
  const reportDir = path.join(targetDir, 'flakiness-report');
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  const reporterOptions: FKJestReporterOptions = {
    ...(options.reporterOptions ?? {}),
    outputFolder: reportDir,
    disableUpload: true,
  };

  const jestConfig = {
    testEnvironment: 'node',
    ...(options.jestConfig ?? {}),
    reporters: [['default', {}], [REPORTER_PATH, reporterOptions]],
  };

  const allFiles: Record<string, string> = {
    ...DEFAULT_FILES,
    ...files,
    'jest.config.mjs': `export default ${JSON.stringify(jestConfig, null, 2)};\n`,
  };

  for (const [filePath, content] of Object.entries(allFiles)) {
    const fullPath = path.join(targetDir, ...filePath.split('/'));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  initGitRepo(targetDir);

  const result = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', JEST_BIN, '--config', 'jest.config.mjs', ...(options.args ?? [])],
    {
      cwd: targetDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...CLEARED_CI_ENV,
        NODE_PATH: [NODE_MODULES_PATH, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
        ...options.env,
      },
    },
  );

  return {
    ...(await readReport(reportDir)),
    cmd: {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      status: result.status ?? 0,
    },
  };
}

function initGitRepo(targetDir: string): void {
  execFileSync('git', ['init'], { cwd: targetDir, stdio: 'pipe' });
  execFileSync('git', ['add', '.'], { cwd: targetDir, stdio: 'pipe' });
  execFileSync(
    'git',
    ['-c', 'user.email=john@example.com', '-c', 'user.name=john', '-c', 'commit.gpgsign=false', 'commit', '-m', 'staging'],
    { cwd: targetDir, stdio: 'pipe' },
  );
}

function slugify(value: string): string {
  return value
    .replace(/[^.a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function assertCount<T>(elements: T[] | undefined, count: number): T[] {
  expect(elements?.length ?? 0).toBe(count);
  return elements!;
}

export function assertStatus(status: FlakinessReport.TestStatus | undefined, expected: FlakinessReport.TestStatus) {
  expect(status ?? 'passed').toBe(expected);
}
