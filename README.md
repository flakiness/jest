# @flakiness/jest — dev notes

Internal scratchpad while building this out. Not a user-facing README yet.

## Supported Jest

- Requires the **jest-circus** test runner. Circus has been the default since Jest 27 (May 2021), so unless a project explicitly opts into `testRunner: 'jest-jasmine2'`, this reporter works out-of-the-box. Jest 30 removed Jasmine entirely.
- We dev-build and test against Jest 30.x; Jest 27–29 on Circus should work without change.
- Jasmine-era statuses (`'skipped'` / `'disabled'` / `'focused'`) are treated as the default `'passed'` fallback — Jasmine isn't a target.

## User-facing gotchas

- **`testLocationInResults`**: Jest does not populate `assertion.location` unless the user opts in via `testLocationInResults: true` in their `jest.config.*`. Without it, `Test.location` is absent from our report. Mention this prominently in the eventual user README.
- **Retry error details** require `jest.retryTimes(n, { logErrorsBeforeRetry: true })`. Without the option, Jest drops prior-attempt errors — the flakiness report still shows the correct attempt count (derived from `invocations`), but the synthesized attempts have empty `errors[]`.
- **`--experimental-vm-modules`**: required when running our own tests (Jest + ESM). End users aren't affected — their Jest config doesn't need it just because our reporter is ESM; their own ESM-ness dictates that.

## Jest limitations we can't work around

- **`configPath`**: Jest doesn't expose the resolved config path to reporters (not in `globalConfig`, `ProjectConfig`, or `ReporterContext`). `jest-config.readInitialOptions()` would work but adds a dep users don't expect.
- **Non-Error throws**: Jest eagerly wraps `throw 'foo'` into `Error { message: 'thrown: "foo"' }` before the reporter sees it. The original `value` is unrecoverable.
- **`describe()` call locations**: Jest doesn't capture them. `Suite.location` will always be undefined.

## Test harness notes

- Tests are dogfood: our reporter built to `lib/reporter.js`, sandbox Jest spawned via `spawnSync` pointing at it.
- Every test creates a fresh git repo in `/private/tmp/flakiness-jest/<slug>`.
- Harness **forces** `outputFolder` + `disableUpload: true` for safety. Testing `FLAKINESS_OUTPUT_DIR` / `FLAKINESS_DISABLE_UPLOAD` env-var paths directly would require a harness escape hatch.
- `testLocationInResults: true` is per-test via `jestConfig` override (see `tests/location.test.ts`). Don't globalize it — it misrepresents real-user defaults.

## Build

- `pnpm build` runs `kubik build.mts`: esbuild transpiles `src/` → `lib/` (no bundle, ESM), then `tsc` emits `.d.ts` to `types/` for both `src/` and `tests/`.
- `pnpm test` runs our Jest on `tests/` (requires `--experimental-vm-modules`). **Does not auto-build**; run `pnpm build` first if `src/` changed.

## SDK quirks worth tracking

- `normalizeReport` in `@flakiness/sdk` didn't strip empty `errors: []` on attempts; fixed upstream in v3. If we pin older, local workaround needed.

## Open TODO

- Feature bucket list and status: see `features.md`.
