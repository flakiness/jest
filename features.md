# Reporter Features — jest

Status of [Flakiness Report Features](https://github.com/flakiness/flakiness-report/blob/main/features.md) as implemented by this
`@flakiness/jest` reporter.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Report metadata | ⚠️ | `commitId`, `flakinessProject`, `startTimestamp`, `duration` populated from Jest's lifecycle hooks; `url` auto-detected via `CIUtils.runUrl()` (GitHub Actions / Azure DevOps / GitLab CI / Jenkins). `configPath` **not populated** — Jest does not expose the resolved config path to reporters |
| 2 | Environment metadata | ✅ | Single environment emitted with `name: 'jest'` and `systemData` (`osName`, `osVersion`, `osArch`) auto-populated via `ReportUtils.createEnvironment()`. |
| 3 | Multiple environments | ❌ | |
| 4 | Custom environments (`FK_ENV_*`) | ❌ | |
| 5 | Test hierarchy / suites | ✅ | One `file` suite per test file (title is git-relative path); nested `suite` layers reconstructed from `AssertionResult.ancestorTitles` (the `describe()` chain). Each test emits a single `RunAttempt` with mapped status, duration, and `startTimestamp`. |
| 6 | Per-attempt reporting (retries) | ❌ | |
| 7 | Per-attempt timeout | ❌ | |
| 8 | Test steps | ❌ | |
| 9 | Expected status (`expectedStatus`) | ❌ | |
| 10 | Attachments | ❌ | |
| 11 | Step-level attachments | ❌ | |
| 12 | Timed StdIO | ❌ | |
| 13 | Annotations | ❌ | |
| 14 | Tags | ❌ | |
| 15 | `parallelIndex` | ❌ | |
| 16 | `FLAKINESS_TITLE` | ❌ | |
| 17 | `FLAKINESS_OUTPUT_DIR` | ❌ | |
| 18 | Sources | ❌ | |
| 19 | Error snippets | ❌ | |
| 20 | Errors support | ❌ | |
| 21 | Unattributed errors | ❌ | |
| 22 | Source locations | ❌ | |
| 23 | Auto-upload | ❌ | |
| 24 | CPU / RAM telemetry | ❌ | |
