[![Tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fflakiness.io%2Fapi%2Fbadge%3Finput%3D%257B%2522badgeToken%2522%253A%2522badge-7F4xAjLMBnhHed4UATY78k%2522%257D)](https://flakiness.io/flakiness/jest)

# Flakiness.io Jest Reporter

A custom Jest reporter that generates Flakiness Reports from your Jest test runs. The reporter converts Jest test results into the standardized [Flakiness JSON format](https://github.com/flakiness/flakiness-report), capturing test outcomes, retries, system utilization, and environment information.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Recommended Jest Config](#recommended-jest-config)
- [Uploading Reports](#uploading-reports)
- [Viewing Reports](#viewing-reports)
- [Features](#features)
  - [Test Location Tracking](#test-location-tracking)
  - [Retry Error Details](#retry-error-details)
  - [Tags](#tags)
  - [Handling Test Duplicates](#handling-test-duplicates)
  - [Environment Detection](#environment-detection)
  - [CI Integration](#ci-integration)
- [Configuration Options](#configuration-options)
  - [`title?: string`](#title-string)
  - [`flakinessProject?: string`](#flakinessproject-string)
  - [`endpoint?: string`](#endpoint-string)
  - [`token?: string`](#token-string)
  - [`outputFolder?: string`](#outputfolder-string)
  - [`duplicates?: 'fail' | 'rename'`](#duplicates-fail--rename)
  - [`disableUpload?: boolean`](#disableupload-boolean)
- [Environment Variables](#environment-variables)
- [Example Configuration](#example-configuration)

## Requirements

- **Jest 27 or higher**, using the **jest-circus** runner (Jest's default since 27). The legacy `jest-jasmine2` runner is not supported.
- Node.js project with a git repository (for commit information)
- Valid Flakiness.io access token (for uploads)

## Installation

```bash
npm install -D @flakiness/jest
```

## Quick Start

Add the reporter to your Jest config:

```js
// jest.config.mjs
export default {
  testLocationInResults: true,
  reporters: [
    'default',
    ['@flakiness/jest', { flakinessProject: 'my-org/my-project' }],
  ],
};
```

> [!NOTE]
> Include `'default'` (or another built-in reporter) alongside the flakiness reporter to retain Jest's standard terminal output — Jest only uses the reporters listed in the `reporters` array.

Run your tests. The report will be automatically generated in the `./flakiness-report` folder:

```bash
npx jest
```

View the interactive report:

```bash
npx flakiness show ./flakiness-report
```

## Recommended Jest Config

Two Jest flags are strongly recommended to get the most out of this reporter:

```js
// jest.config.mjs
export default {
  testLocationInResults: true,
  reporters: ['default', ['@flakiness/jest', {}]],
};
```

- **`testLocationInResults: true`** — populates `assertion.location` so the report can pin each test to its exact file and line in your source.
- **`jest.retryTimes(n, { logErrorsBeforeRetry: true })`** — when retries are enabled, this flag preserves the error from each prior attempt. Without it, Jest drops those errors and the retry attempts in the report carry the correct count but empty `errors[]` arrays.

## Uploading Reports

Reports are automatically uploaded to Flakiness.io after test completion. Authentication can be done in two ways:

- **GitHub OIDC**: When running in GitHub Actions, the reporter can authenticate using GitHub's OIDC token — no access token needed. This requires two conditions:
  1. The `flakinessProject` option must be set to your Flakiness.io project identifier (`org/project`).
  2. The Flakiness.io project must be bound to the GitHub repository that runs the GitHub Actions workflow.
- **Access token**: Provide a token via the `token` option or the `FLAKINESS_ACCESS_TOKEN` environment variable.

If upload fails, the report is still available locally in the output folder.

## Viewing Reports

After test execution:

```bash
npx flakiness show ./flakiness-report
```

## Features

See [features.md](./features.md) for this reporter's status against the [Flakiness Report spec](https://github.com/flakiness/flakiness-report/blob/main/features.md).

### Test Location Tracking

When `testLocationInResults: true` is set in your Jest config, the reporter records the exact file, line, and column for each test. This enables precise navigation from the Flakiness.io dashboard back to your source code.

### Retry Error Details

When retries are enabled via `jest.retryTimes(n)`, the reporter emits one `RunAttempt` per invocation — the correct attempt count is always preserved. To also capture the error from each prior attempt (not just the final one), pass `{ logErrorsBeforeRetry: true }`:

```js
jest.retryTimes(3, { logErrorsBeforeRetry: true });
```

Without this option, Jest discards prior-attempt errors and the synthesized retry attempts carry no error details.

### Tags

The reporter extracts trailing `@word` tokens from test titles into `tags`:

```js
describe('api tests @api', () => {
  test('login @smoke @regression', () => { /* ... */ });
});
```

The test above is tagged with `api`, `smoke`, and `regression`. Rules:

- Tags must be **trailing** — `test('ping @alice in slack', ...)` does not extract `alice`.
- `@` embedded inside a word (`alice@example.com`) is never a tag.

### Handling Test Duplicates

Jest allows tests with identical names in the same describe block. Flakiness.io, however, considers two tests *duplicates* when they share the same suite hierarchy, title, and environment, because each test's history is keyed off its full name.

When the reporter detects duplicate full names, it warns and handles them according to the [`duplicates`](#duplicates-fail--rename) option.

### Environment Detection

For each Jest project (configured via `projects: [...]`), the reporter creates a unique environment. The environment name comes from the project's `displayName`; if missing, it defaults to `"jest"`. If two projects share a `displayName`, subsequent environments are suffixed ` (2)`, ` (3)`, and so on, so every environment is distinctly labeled.

The test environment (`node`, `jsdom`, or a custom environment) is recorded under `metadata.testEnvironment`.

Environment variables prefixed with `FK_ENV_` are automatically included in the environment metadata. The prefix is stripped and the key is converted to lowercase.

**Example:**

```bash
export FK_ENV_DEPLOYMENT=staging
export FK_ENV_REGION=us-east-1
```

Results in environment metadata:

```json
{
  "metadata": {
    "deployment": "staging",
    "region": "us-east-1"
  }
}
```

Flakiness.io creates a dedicated history for tests executed in each unique environment — tests run with `FK_ENV_DEPLOYMENT=staging` get a separate timeline from tests run with `FK_ENV_DEPLOYMENT=production`.

### CI Integration

The reporter automatically detects CI environments and includes:

- CI run URLs (GitHub Actions, Azure DevOps, Jenkins, GitLab CI)
- Git commit information
- System metadata (OS name, version, arch)
- CPU and RAM utilization sampled during the run

## Configuration Options

### `title?: string`

Optional human-readable report title. Typically used to name a CI run, matrix shard, or other execution group. Defaults to the `FLAKINESS_TITLE` environment variable, or empty otherwise.

```js
reporters: [
  ['@flakiness/jest', { title: 'smoke tests run' }]
]
```

### `flakinessProject?: string`

The Flakiness.io project identifier in `org/project` format. Used for GitHub OIDC authentication — when set, and the Flakiness.io project is bound to the GitHub repository running the workflow, the reporter authenticates uploads via GitHub Actions OIDC token with no access token required.

```js
reporters: [
  ['@flakiness/jest', { flakinessProject: 'my-org/my-project' }]
]
```

### `endpoint?: string`

Custom Flakiness.io endpoint URL for uploading reports. Defaults to the `FLAKINESS_ENDPOINT` environment variable, or `https://flakiness.io` if not set.

```js
reporters: [
  ['@flakiness/jest', { endpoint: 'https://custom.flakiness.io' }]
]
```

### `token?: string`

Access token for authenticating with Flakiness.io when uploading reports. Defaults to the `FLAKINESS_ACCESS_TOKEN` environment variable. If no token is provided, the reporter attempts to authenticate via GitHub OIDC.

```js
reporters: [
  ['@flakiness/jest', { token: 'your-access-token' }]
]
```

### `outputFolder?: string`

Directory path where the Flakiness report will be written. Defaults to the `FLAKINESS_OUTPUT_DIR` environment variable, or `flakiness-report` in the current working directory.

```js
reporters: [
  ['@flakiness/jest', { outputFolder: './test-results/flakiness' }]
]
```

### `duplicates?: 'fail' | 'rename'`

Controls how the reporter handles tests with duplicate full names. Defaults to `'fail'`.

- **`'fail'`** (default): Duplicates are collapsed into a single failing test with a descriptive error and a `dupe` annotation. The first duplicate absorbs the error; the remaining ones have their attempts stripped. This is the recommended mode — it surfaces the problem so you can fix it by renaming your tests.
- **`'rename'`**: Duplicates are automatically renamed by appending a suffix (e.g., ` – dupe #2`, ` – dupe #3`) to their titles. Each renamed test receives a `dupe` annotation on all its attempts. The first test keeps its original title; only subsequent duplicates are renamed.

> [!WARNING]
> The `'rename'` mode is not recommended for regular use. Rename ordering depends on the order Jest reports duplicates, which may shift between runs — so the same duplicate can end up with different suffixes and broken history.

```js
reporters: [
  ['@flakiness/jest', { duplicates: 'rename' }]
]
```

### `disableUpload?: boolean`

When `true`, the report is written locally but not uploaded to Flakiness.io. Can also be controlled via the `FLAKINESS_DISABLE_UPLOAD` environment variable.

```js
reporters: [
  ['@flakiness/jest', { disableUpload: true }]
]
```

## Environment Variables

- **`FLAKINESS_TITLE`**: Human-readable report title (equivalent to `title` option)
- **`FLAKINESS_ACCESS_TOKEN`**: Access token for Flakiness.io uploads (equivalent to `token` option)
- **`FLAKINESS_ENDPOINT`**: Custom Flakiness.io endpoint URL (equivalent to `endpoint` option)
- **`FLAKINESS_OUTPUT_DIR`**: Output directory for reports (equivalent to `outputFolder` option)
- **`FLAKINESS_DISABLE_UPLOAD`**: When set, disables report uploads (equivalent to `disableUpload` option)
- **`FK_ENV_*`**: Each `FK_ENV_<KEY>` env var is added to `environment.metadata` as `{ <key>: <value> }` (prefix stripped, key lowercased)

## Example Configuration

A complete example with all options:

```js
// jest.config.mjs
export default {
  testLocationInResults: true,
  reporters: [
    'default',
    ['@flakiness/jest', {
      title: 'My Test Run',
      flakinessProject: 'my-org/my-project',
      endpoint: process.env.FLAKINESS_ENDPOINT,
      token: process.env.FLAKINESS_ACCESS_TOKEN,
      outputFolder: './flakiness-report',
      duplicates: 'fail',
      disableUpload: false,
    }],
  ],
};
```
