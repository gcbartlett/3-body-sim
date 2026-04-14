# Playwright Adoption Plan

This plan introduces Playwright end-to-end (E2E) testing in stages so we get fast confidence on critical user flows without slowing down the existing Vitest unit test suite.

## 1) Setup and tooling baseline

### 1.1 Add dependencies
- Add Playwright test runner as a dev dependency:
  - `@playwright/test`
- Install browser binaries with:
  - `npx playwright install --with-deps`

### 1.2 Add scripts to `package.json`
- `test:e2e`: Run Playwright suite in headless mode.
- `test:e2e:ui`: Open Playwright UI mode for local debugging.
- `test:e2e:headed`: Run tests in headed mode.
- `test:e2e:report`: Open the generated HTML report.

### 1.3 Directory structure
Create the following structure:
- `playwright.config.ts`
- `tests/e2e/` for spec files.
- `tests/e2e/fixtures/` for shared fixtures/helpers.
- `tests/e2e/pageObjects/` for reusable UI interactions.
- `tests/e2e/snapshots/` only if visual regression snapshots are introduced.

## 2) Configuration

### 2.1 Base Playwright configuration
In `playwright.config.ts`:
- Set `testDir` to `tests/e2e`.
- Use `baseURL` from `http://127.0.0.1:4173` (Vite preview default for CI), overridable by env var.
- Configure `webServer` to start the app before tests:
  - Prefer `npm run build && npm run preview -- --host 127.0.0.1 --port 4173` for production-like behavior.
  - Use `reuseExistingServer: !process.env.CI` for local speed.
- Enable retries in CI (`retries: 2`) and parallel execution where stable.
- Enable traces/screenshots/video on failure to reduce debugging time.

### 2.2 Browser/project matrix
Start with one project (`chromium`) for stability and speed, then expand:
- Phase 1: `chromium`
- Phase 2: add `firefox`
- Phase 3: add `webkit` (if needed for cross-browser confidence)

### 2.3 Determinism and flake controls
- Use stable `data-testid` hooks for key controls/actions.
- Freeze or mock nondeterministic values where required (e.g., random profile generation tests).
- Prefer semantic assertions and explicit waits (`expect(locator).toBeVisible()`) over timeout sleeps.
- Keep each spec independent: no reliance on previous test state.

## 3) Initial high-value test suite (first milestone)

Focus on workflows with highest user impact and highest breakage risk.

### 3.1 App boot and baseline rendering
1. **Loads main simulator shell**
   - App renders canvas/stage area.
   - Control panel sections are visible.
2. **No fatal runtime error on startup**
   - Assert no uncaught page errors during initial load.

### 3.2 Core simulation controls
3. **Start / pause simulation**
   - Toggle run state from controls.
   - Assert state indicator changes appropriately.
4. **Step acceleration controls**
   - Increase/decrease simulation speed.
   - Assert displayed speed/step value updates.

### 3.3 Profile and parameter editing
5. **Edit body parameters**
   - Update a numeric field (mass/position/velocity).
   - Assert input precision/validation behavior and persisted UI value.
6. **Validation guardrails**
   - Enter invalid numeric input and assert validation messaging or disabled action states.

### 3.4 Presets and persistence
7. **Load built-in preset**
   - Select a preset and assert values change in panel and/or diagnostics.
8. **Save + reload user preset (local persistence)**
   - Save a custom preset.
   - Reload page and verify the preset is still available and loadable.

### 3.5 Camera and stage interaction
9. **Stage interaction sanity**
   - Pan/zoom or equivalent stage control.
   - Assert viewport state or visible diagnostics reflects interaction.
10. **Hover diagnostics visibility**
   - Hover a body marker and assert tooltip/diagnostic card appears with expected fields.

## 4) Recommended implementation order

### Sprint 1 (foundation)
- Add Playwright deps, config, scripts, and CI job stub.
- Add test IDs for unstable selectors in key controls.
- Implement specs 1-4.

### Sprint 2 (data integrity)
- Implement specs 5-8.
- Add helper utilities for repeated control-panel interactions.

### Sprint 3 (interaction depth)
- Implement specs 9-10.
- Add cross-browser runs (at least Firefox) once baseline is stable.

## 5) CI integration plan

### 5.1 Pipeline steps
1. Install Node deps.
2. Install Playwright browsers (`npx playwright install --with-deps`).
3. Run `npm run build`.
4. Run `npm run test:e2e`.
5. Upload Playwright HTML report and traces as artifacts on failure.

### 5.2 Merge gating
- Initially: non-blocking informational job for 1-2 weeks.
- Then: required check for `chromium` E2E suite once flake rate is acceptable.

## 6) Quality bar and maintenance

- Keep E2E suite small and high-value; push logic-heavy checks to Vitest unit tests.
- Target runtime budget: under ~5 minutes in CI for default browser project.
- Quarantine flaky tests with a ticket and owner; do not silently ignore failures.
- Review selectors and fixtures quarterly to prevent brittleness.

## 7) Definition of done for Playwright rollout

- Playwright is configured and runnable locally + in CI.
- At least 8 of the 10 high-value tests above are passing in Chromium.
- Failure artifacts (trace/screenshot/report) are available in CI.
- Team documentation includes how to run and debug E2E tests locally.
