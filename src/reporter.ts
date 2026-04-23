import { FlakinessReport as FK } from '@flakiness/flakiness-report';
import { CIUtils, GitWorktree, ReportUtils, showReportCommand, uploadReport, writeReport } from '@flakiness/sdk';
import type { AggregatedResult, Config, Reporter, ReporterContext, ReporterOnStartOptions, TestContext, TestResult } from '@jest/reporters';
import path from 'node:path';
import * as nodeUtil from 'node:util';
import StackUtils from 'stack-utils';

type AssertionResult = TestResult['testResults'][number];

const stackUtils = new StackUtils({ internals: StackUtils.nodeInternals() });

function parseErrorLocation(worktree: GitWorktree, testFilePath: string, stackText: string): FK.Location | undefined {
  let firstUserFrame: FK.Location | undefined;
  let firstTestFrame: FK.Location | undefined;
  for (const line of stackText.split('\n')) {
    const frame = stackUtils.parseLine(line);
    if (!frame?.file || !frame.line || !frame.column)
      continue;
    // stack-utils strips cwd from absolute paths; re-absolutize before gitPath.
    const absFile = path.isAbsolute(frame.file) ? frame.file : path.resolve(process.cwd(), frame.file);
    const loc: FK.Location = {
      file: worktree.gitPath(absFile),
      line: frame.line as FK.Number1Based,
      column: frame.column as FK.Number1Based,
    };
    if (loc.file === testFilePath)
      firstTestFrame ??= loc;
    if (!absFile.includes('node_modules'))
      firstUserFrame ??= loc;
  }
  return firstTestFrame ?? firstUserFrame;
}

function collectAttemptErrors(
  worktree: GitWorktree,
  fileResult: TestResult,
  assertion: AssertionResult,
): FK.ReportError[] {
  // `failureDetails[i]` and `failureMessages[i]` are built in lockstep in jest-circus.
  const details = assertion.failureDetails as Array<{ message: string }>;
  const messages = assertion.failureMessages;
  const testFilePath = worktree.gitPath(fileResult.testFilePath);
  return details.map((detail, i) => {
    const cleanStack = ReportUtils.stripAnsi(messages[i]);
    return {
      message: ReportUtils.stripAnsi(detail.message).split('\n')[0],
      stack: cleanStack,
      location: parseErrorLocation(worktree, testFilePath, cleanStack),
    };
  });
}

function errorFromStackString(worktree: GitWorktree, testFilePath: string, stackText: string): FK.ReportError {
  const cleanStack = ReportUtils.stripAnsi(stackText);
  const firstLine = cleanStack.split('\n')[0] ?? '';
  // Strip leading "Error: " / "AssertionError: " / etc.
  const message = firstLine.replace(/^\s*[\w.]*Error:\s*/, '').trim();
  return {
    message,
    stack: cleanStack,
    location: parseErrorLocation(worktree, testFilePath, cleanStack),
  };
}

function mapStatus(status: AssertionResult['status']): FK.TestStatus {
  switch (status) {
    case 'passed': return 'passed';
    case 'failed': return 'failed';
    case 'pending':
    case 'skipped':
    case 'todo':
    case 'disabled':
      return 'skipped';
    default:
      return 'passed';
  }
}

export type FKJestReporterOptions = {
  disableUpload?: boolean;
  flakinessProject?: string;
  endpoint?: string;
  token?: string;
  outputFolder?: string;
  title?: string;
};

export interface FKJestLogger {
  log(txt: string): void;
  warn(txt: string): void;
  error(txt: string): void;
}

type StyleTextFormat = Parameters<NonNullable<typeof nodeUtil.styleText>>[0];
const styleText = (format: StyleTextFormat, text: string) =>
  nodeUtil.styleText?.(format, text) ?? text;

export default class FKJestReporter implements Reporter {
  private _rootDir: string;
  private _startTimestamp = 0;
  private _logger: FKJestLogger = {
    warn: txt => console.warn(styleText('yellow', txt)),
    error: txt => console.error(styleText('red', txt)),
    log: txt => console.log(txt),
  };

  constructor(
    globalConfig: Config.GlobalConfig,
    private _options: FKJestReporterOptions = {},
    reporterContext?: ReporterContext,
  ) {
    this._rootDir = globalConfig.rootDir;
  }

  setLoggerForTest(logger: FKJestLogger) {
    this._logger = logger;
  }

  private _attachTest(fileSuite: FK.Suite, assertion: AssertionResult, fileResult: TestResult, worktree: GitWorktree) {
    let parent = fileSuite;
    for (const title of assertion.ancestorTitles) {
      parent.suites ??= [];
      let next = parent.suites.find(s => s.type === 'suite' && s.title === title);
      if (!next) {
        next = { type: 'suite', title };
        parent.suites.push(next);
      }
      parent = next;
    }
    const testFilePath = worktree.gitPath(fileResult.testFilePath);
    // `startAt` is unset for tests that never executed (skip/todo/only-excluded) or file-level import failures.
    const startTimestamp = (assertion.startAt ?? fileResult.perfStats.start) as FK.UnixTimestampMS;

    // Jest does not preserve per-retry timing. It also only populates `retryReasons` when the user
    // opts in via `jest.retryTimes(n, { logErrorsBeforeRetry: true })`; otherwise prior errors are
    // dropped. We synthesize N-1 failed attempts (from `invocations`) and use whatever retryReasons
    // are available for error detail.
    const invocations = assertion.invocations ?? 1;
    const retryReasons = assertion.retryReasons ?? [];
    const attempts: FK.RunAttempt[] = [];
    for (let i = 0; i < invocations - 1; ++i) {
      attempts.push({
        environmentIdx: 0,
        status: 'failed',
        startTimestamp,
        duration: 0 as FK.DurationMS,
        errors: retryReasons[i] ? [errorFromStackString(worktree, testFilePath, retryReasons[i])] : [],
      });
    }
    attempts.push({
      environmentIdx: 0,
      status: mapStatus(assertion.status),
      startTimestamp,
      duration: ((assertion.duration ?? 0) as FK.DurationMS),
      errors: collectAttemptErrors(worktree, fileResult, assertion),
    });

    const testLocation: FK.Location | undefined = assertion.location ? {
      file: testFilePath,
      line: assertion.location.line as FK.Number1Based,
      column: assertion.location.column as FK.Number1Based,
    } : undefined;
    const test: FK.Test = {
      title: assertion.title,
      location: testLocation,
      attempts,
    };
    parent.tests ??= [];
    parent.tests.push(test);
  }

  onRunStart(_results: AggregatedResult, _options: ReporterOnStartOptions) {
    this._startTimestamp = Date.now();
  }

  async onRunComplete(_testContexts?: Set<TestContext>, results?: AggregatedResult) {
    const worktreeResult = GitWorktree.initialize(this._rootDir);
    if (!worktreeResult.ok) {
      this._logger.warn('[flakiness.io] Failed to fetch commit info - is this a git repo?');
      this._logger.error('[flakiness.io] Report is NOT generated.');
      return;
    }
    const { worktree, commitId } = worktreeResult;
    const duration = (Date.now() - this._startTimestamp) as FK.DurationMS;

    const fileSuites: FK.Suite[] = [];
    for (const fileResult of results?.testResults ?? []) {
      const fileSuite: FK.Suite = {
        type: 'file',
        title: worktree.gitPath(fileResult.testFilePath),
      };
      for (const assertion of fileResult.testResults)
        this._attachTest(fileSuite, assertion, fileResult, worktree);
      fileSuites.push(fileSuite);
    }

    const report: FK.Report = ReportUtils.normalizeReport({
      title: this._options.title ?? process.env.FLAKINESS_TITLE,
      url: CIUtils.runUrl(),
      flakinessProject: this._options.flakinessProject,
      category: 'jest',
      commitId,
      environments: [ReportUtils.createEnvironment({ name: 'jest' })],
      startTimestamp: this._startTimestamp as FK.UnixTimestampMS,
      duration,
      suites: fileSuites,
    });
    await ReportUtils.collectSources(worktree, report);

    const outputFolder = this._options.outputFolder ?? path.join(
      process.cwd(),
      process.env.FLAKINESS_OUTPUT_DIR ?? 'flakiness-report',
    );
    await writeReport(report, [], outputFolder);

    const disableUpload = !!this._options.disableUpload || !!process.env.FLAKINESS_DISABLE_UPLOAD;
    if (!disableUpload) {
      await uploadReport(report, [], {
        flakinessAccessToken: this._options.token,
        flakinessEndpoint: this._options.endpoint,
        logger: this._logger,
      });
    }

    const command = showReportCommand(outputFolder);
    this._logger.log(`
To open last Flakiness report, run:

  ${styleText('cyan', command)}
    `);
  }
}
