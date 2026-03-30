# Architecture

This document contains the detailed project structure map.

## Simulation Notes

- Physics is Newtonian point-mass gravity with softening `epsilon` to avoid singular acceleration at close approach.
- Integrator is Velocity Verlet (`src/sim/integrators.ts`).
- Ejection logic requires sustained strong-escape conditions before flagging a body as ejected.
- Dissolution is detected when no pair remains bound long enough, then the simulation pauses.
- Rewind is snapshot-backed: each simulation step can be restored from history with a configurable buffer depth.
- Step forward/back supports hold acceleration from both keyboard hotkeys and pointer press-and-hold.
- History depth configuration lives in the Control Panel simulation-parameters section; the stage controls show live buffer fill and memory estimate.
- The simulation loop is invalidation-driven while paused: RAF runs continuously only when `world.isRunning`, and paused redraws are requested on demand via `requestRender`.
- While running, simulation/draw still execute each RAF tick, but React `world` publishes are throttled to 15 Hz in `useSimulationLoop` (with immediate publish on run-state transitions such as auto-pause).

## Performance Instrumentation

- Optional runtime performance logging is implemented in `src/perf/perfMonitor.ts`.
- Enable with URL `?perf=1` or `localStorage` key `threeBodyPerf=1`.
- Metrics include per-window durations/counters/gauges for RAF, simulation, rendering, history, hover, layout observers, and React Profiler segments.
- React Profiler hooks are wired at `AppRoot` and key stage/control subtrees for commit timing visibility.
- Canvas diagnostics content is lazily rendered only while the diagnostics panel is open.
- Diagnostics open/closed state is surfaced back to `App`; while closed, heavy diagnostics view-model arrays are skipped in `useAppViewModels` to reduce per-frame React-side work.

## Persistence

The app stores UI and user data in browser `localStorage`, including:

- Simulation parameters
- User-created preset profiles
- Panel expanded/collapsed state
- Control section open states
- Diagnostics panel open state

## Project Structure

```text
src/                                   # Application source code
  App.tsx                              # Composition root and high-level wiring
  config/                              # App-level constants and external links
    appLinks.ts                        # External destination links used by UI actions
  main.tsx                             # React entry point
  perf/                                # Runtime performance monitoring helpers
    perfMonitor.ts                     # Opt-in performance metrics collection + console reporting
  styles.css                           # Layout and visual styling
  vite-env.d.ts                        # Vite ambient types and compile-time constants
  render/                              # Canvas rendering utilities
    canvasRenderer.ts                  # Top-level frame orchestration and trail fade/prune helpers
    layers/                            # Focused canvas draw layers and shared layer types
      bodyLayer.ts                     # Body radius mapping and body/halo primitive drawing
      gridLayer.ts                     # Adaptive grid/axis line rendering
      overlayLayer.ts                  # Origin and center-of-mass overlays
      trailLayer.ts                    # Body trail point drawing and color alpha handling
      types.ts                         # Shared render-layer contracts (viewport/options/trails)
  sim/                                 # Simulation domain logic and policies
    camera.ts                          # Camera transforms and tracking helpers
    cameraPolicy.ts                    # Auto-camera framing and lock-mode policy
    defaults.ts                        # Default bodies/params/world
    diagnosticFormatting.ts            # Shared diagnostics text formatting
    ejection.ts                        # Ejection metrics and detection
    hoverDiagnostics.ts                # Hover tooltip diagnostic assembly
    integrators.ts                     # Velocity Verlet stepper
    physics.ts                         # Accelerations, COM, energy, momentum
    presetStorage.ts                   # localStorage key IO wrappers for params/presets/UI prefs
    presetStorageCodecs.ts             # Pure decode/sanitize/defaulting codecs for persisted sim data
    presets.ts                         # Built-in preset profiles
    profileValidation.ts               # Save/edit validation and selected-preset dirty-state helpers
    randomProfiles.ts                  # Random stable/chaotic body generators
    sessionTransitions.ts              # Runtime world transition helpers
    diagnosticsSelectors.ts            # Diagnostics view-model selectors/helpers
    simulationPolicies.ts              # Shared runtime policy constants/helpers
    simulationFrame.ts                 # Per-frame simulation pipeline (step/camera/render/hover gating)
    simulationHistory.ts               # Snapshot history push/pop/restore and history metrics helpers
    stageSelectors.ts                  # Stage status/bound-pair labeling selectors
    simulationTick.ts                  # Per-frame stepping transition logic
    types.ts                           # Canonical shared simulation/domain types
    useDraftEditPolicy.ts              # Stopped-world draft edit policy
    useSimulationLoop.ts               # RAF loop orchestration with running-mode cadence + paused invalidation rendering
    useEditPresetCommands.ts           # User preset edit dialog state and edit-confirm commands
    useSavePresetCommands.ts           # User preset save dialog state and save-confirm commands
    useSessionPresetCommands.ts        # Session preset/random apply command policy
    useSimulationSession.ts            # Session command orchestration (start/reset/step + draft edits)
    useUserPresetCommands.ts           # User preset command composition + delete/fallback handling
    vector.ts                          # Vector utilities
    worldState.ts                      # Canonical stopped-world constructors
  ui/                                  # UI components, dialogs, and hooks
    CanvasDiagnostics.tsx              # Diagnostics panel
    ControlPanel.tsx                   # Control panel composition (memoized to avoid unnecessary rerenders)
    EditProfileDialog.tsx              # Edit-profile modal
    SaveProfileDialog.tsx              # Save-profile modal
    sponsorPage.ts                     # Sponsor link opener with window-target policy
    stepAcceleration.ts                # Shared hold-to-accelerate burst thresholds and state
    controlPanel/                      # Control panel sections and shared inputs
      BodyConfigurationSection.tsx     # Body mass/position/velocity editors
      PresetsSection.tsx               # Preset selection/apply/random/save controls
      SimulationParametersSection.tsx  # Global sim parameters + history depth configuration
      StepperNumberInput.tsx           # Shared numeric input with stepping/precision behavior
      numberInputPrecision.ts          # Decimal precision helper for control-panel number inputs
      types.ts                         # Shared control-panel prop types
    diagnostics/                       # Diagnostics-specific display components
      BodyDiagnosticsColumn.tsx        # Per-body diagnostics column component
      DiagnosticsSummaryColumn.tsx     # Aggregate diagnostics summary component
      styles.ts                        # Diagnostics layout/style constants
    stage/                             # Stage controls, HUD, and hover overlays
      HoverTooltip.tsx                 # Hover tooltip overlay
      StageControls.tsx                # Run/reset/step controls, alerts, and live history buffer status
      StageHud.tsx                     # Status strip and panel toggle
    uiPrefsStorage.ts                  # UI open-state persistence helpers
    useAppPersistence.ts               # App-level persistence side effects
    useAppUiPreferences.ts             # App UI preference state initialization and setters
    useAppRuntimeState.ts              # App runtime refs + manual-mode sync glue
    useStableCallback.ts               # Stable-callback helper for memoized child prop identities
    useAppViewModels.ts                # Stage/diagnostics view-model and prop assembly
    useCanvasCameraControls.ts         # Pointer/touch/wheel camera interactions
    useControlPanelSections.ts         # Control-panel section open-state ownership + persistence
    useHoverTooltipState.ts            # Hover tooltip lifecycle/state hook
    useSimulationHotkeys.ts            # Keyboard shortcut handling
    useStageViewport.ts                # Canvas container/viewport sizing hook
tests/                                 # Automated test suites
  unit/                                # Unit tests by feature area
    render/                            # Unit tests for rendering modules
      canvasRenderer.test.ts           # Unit tests for render orchestration and trail behavior
    sim/                               # Unit tests for simulation modules
      camera.test.ts                   # Unit tests for camera transforms and updates
      cameraPolicy.test.ts             # Unit tests for auto-camera policy behavior
      defaults.test.ts                 # Unit tests for default bodies/params/world factories
      diagnosticFormatting.test.ts     # Unit tests for diagnostics text formatting
      diagnosticsSelectors.test.ts     # Unit tests for diagnostics selectors
      ejection.test.ts                 # Unit tests for ejection detection logic
      hoverDiagnostics.test.ts         # Unit tests for hover diagnostics selectors
      integrators.test.ts              # Unit tests for velocity Verlet integration
      physics.test.ts                  # Unit tests for accelerations/energy/momentum
      presetStorage.test.ts            # Unit tests for storage wrapper load/save behavior
      presetStorageCodecs.test.ts      # Unit tests for persisted-data decoding/sanitization codecs
      presets.test.ts                  # Unit tests for body clone helper behavior
      profileValidation.test.ts        # Unit tests for saved profile validation rules
      randomProfiles.test.ts           # Unit tests for random profile generation invariants
      sessionTransitions.test.ts       # Unit tests for runtime transition helpers
      simulationFrame.test.ts          # Unit tests for per-frame simulation/render coordination
      simulationHistory.test.ts        # Unit tests for snapshot history clamp/push/pop/restore behavior
      simulationPolicies.test.ts       # Unit tests for simulation policy helpers
      simulationTick.test.ts           # Unit tests for per-step simulation updates
      stageSelectors.test.ts           # Unit tests for stage status selector helpers
      types.test.ts                    # Unit tests for lock-mode type-guard validation
      useDraftEditPolicy.test.ts       # Unit tests for stopped-world edit policy and history clearing
      useSimulationLoop.test.ts        # Unit tests for RAF loop orchestration and lifecycle behavior
      vector.test.ts                   # Unit tests for vector utility functions
      worldState.test.ts               # Unit tests for stopped-world construction helpers
    ui/                                # Unit tests for UI modules
      sponsorPage.test.ts              # Unit tests for sponsor window-opening behavior
      stageControls.test.tsx           # Unit tests for stage controls hold acceleration/disabled back state
      uiPrefsStorage.test.ts           # Unit tests for UI preference persistence helpers
      useAppViewModels.test.ts         # Unit tests for app-level stage/diagnostic view-model assembly
      useSimulationHotkeys.test.ts     # Unit tests for hotkey dispatch and hold acceleration behavior
      controlPanel/                    # Unit tests for control-panel helpers
        numberInputPrecision.test.ts   # Unit tests for decimal precision parsing/clamping
      diagnostics/                     # Unit tests for diagnostics UI helpers
        styles.test.ts                 # Unit tests for diagnostics highlight style selectors
docs/                                  # Project docs and static doc assets
  3BodySim.png                         # Screenshot image
  README.md                            # Project documentation (this file)
  ARCHITECTURE.md                      # Detailed project structure and architecture notes
```
