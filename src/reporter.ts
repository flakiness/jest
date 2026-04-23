import { FlakinessReport as FK } from '@flakiness/flakiness-report';
import { CIUtils, GitWorktree, ReportUtils, showReportCommand, uploadReport, writeReport } from '@flakiness/sdk';
import type { AggregatedResult, Config, Reporter, ReporterContext, ReporterOnStartOptions, TestContext } from '@jest/reporters';
import path from 'node:path';
import * as nodeUtil from 'node:util';

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

  onRunStart(_results: AggregatedResult, _options: ReporterOnStartOptions) {
    this._startTimestamp = Date.now();
  }

  async onRunComplete(_testContexts?: Set<TestContext>, _results?: AggregatedResult) {
    const worktreeResult = GitWorktree.initialize(this._rootDir);
    if (!worktreeResult.ok) {
      this._logger.warn('[flakiness.io] Failed to fetch commit info - is this a git repo?');
      this._logger.error('[flakiness.io] Report is NOT generated.');
      return;
    }
    const { worktree, commitId } = worktreeResult;
    const duration = (Date.now() - this._startTimestamp) as FK.DurationMS;

    const report: FK.Report = ReportUtils.normalizeReport({
      title: this._options.title ?? process.env.FLAKINESS_TITLE,
      url: CIUtils.runUrl(),
      flakinessProject: this._options.flakinessProject,
      category: 'jest',
      commitId,
      environments: [ReportUtils.createEnvironment({ name: 'jest' })],
      startTimestamp: this._startTimestamp as FK.UnixTimestampMS,
      duration,
      suites: [],
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
