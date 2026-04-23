# Reporter Features — jest

Status of [Flakiness Report Features](https://github.com/flakiness/flakiness-report/blob/main/features.md) as implemented by this
`@flakiness/jest` reporter.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Report metadata | ⚠️ | `commitId`, `flakinessProject`, `startTimestamp`, `duration` populated from Jest's lifecycle hooks; `url` auto-detected via `CIUtils.runUrl()` (GitHub Actions / Azure DevOps / GitLab CI / Jenkins). `configPath` **not populated** — Jest does not expose the resolved config path to reporters |
| 2 | Environment metadata | ✅ | Single environment emitted with `name: 'jest'` and `systemData` (`osName`, `osVersion`, `osArch`) auto-populated via `ReportUtils.createEnvironment()`. |
| 3 | Multiple environments | ❌ | |
| 4 | Custom environments (`FK_ENV_*`) | ✅ | Handled transparently by `@flakiness/sdk`'s `ReportUtils.createEnvironment()`; reporter just calls it. |
| 5 | Test hierarchy / suites | ✅ | One `file` suite per test file (title is git-relative path); nested `suite` layers reconstructed from `AssertionResult.ancestorTitles` (the `describe()` chain). Each test emits a single `RunAttempt` with mapped status, duration, and `startTimestamp`. |
| 6 | Per-attempt reporting (retries) | ⚠️ | N-1 failed `RunAttempt`s synthesized from `AssertionResult.invocations` + 1 final attempt from the regular status/errors. Per-retry error details only available when the user calls `jest.retryTimes(n, { logErrorsBeforeRetry: true })`; otherwise Jest drops prior errors and synthesized attempts have empty `errors[]` (attempt count still correct). Jest does not expose per-retry timing, so synthesized attempts share `startTimestamp` and have `duration: 0`. |
| 7 | Per-attempt timeout | ❌ | |
| 8 | Test steps | N/A | Jest has no native step concept. Hook events (`beforeEach`/`afterEach`/etc.) exist on jest-circus's internal event bus but are not re-emitted to reporters — only hook *errors* reach us (surfaced as extra entries in `attempt.errors`). Reporting hooks-as-steps would require shipping a custom Jest test environment. |
| 9 | Expected status (`expectedStatus`) | ✅ | `test.failing()` → `AssertionResult.failing` → attempt's `expectedStatus: 'failed'`. Applies to all synthesized retry attempts as well. |
| 10 | Attachments | ❌ | |
| 11 | Step-level attachments | N/A | No steps (see #8). |
| 12 | Timed StdIO | ❌ | |
| 13 | Annotations | ❌ | |
| 14 | Tags | ❌ | |
| 15 | `parallelIndex` | ❌ | |
| 16 | `FLAKINESS_TITLE` | ✅ | Honored as report `title` when no explicit `title` option is passed; explicit option always wins. |
| 17 | `FLAKINESS_OUTPUT_DIR` | ✅ | Honored as output folder (joined to `process.cwd()`) when no explicit `outputFolder` option is passed; defaults to `flakiness-report`. |
| 18 | Sources | ❌ | |
| 19 | Error snippets | ❌ | |
| 20 | Errors support | ✅ | Each attempt's `errors[]` populated from `AssertionResult.failureMessages` + `failureDetails`; `message`, `stack`, and parsed `location` emitted. Multi-error arrays appear when e.g. a hook also throws. `value` (non-Error throws) is not surfaced separately — Jest wraps thrown non-Errors into a synthetic `Error` with `message: "thrown: <formatted>"` before the reporter sees anything. |
| 21 | Unattributed errors | ❌ | |
| 22 | Source locations | ⚠️ | `Test.location` populated when Jest's `testLocationInResults: true` is set. `ReportError.location` parsed from stack (first frame inside the test file, else first frame outside `node_modules`). `Suite.location` **not** populated — Jest doesn't expose `describe()` call sites. |
| 23 | Auto-upload | ❌ | |
| 24 | CPU / RAM telemetry | ✅ | Sampled every 1s via SDK's `CPUUtilization` + `RAMUtilization`; enriched into report at `onRunComplete`. |
