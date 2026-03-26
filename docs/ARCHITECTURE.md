# Architecture

This document contains the detailed project structure map.

## Simulation Notes

- Physics is Newtonian point-mass gravity with softening `epsilon` to avoid singular acceleration at close approach.
- Integrator is Velocity Verlet (`src/sim/integrators.ts`).
- Ejection logic requires sustained strong-escape conditions before flagging a body as ejected.
- Dissolution is detected when no pair remains bound long enough, then the simulation pauses.

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
  main.tsx                             # React entry point
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
    stageSelectors.ts                  # Stage status/bound-pair labeling selectors
    simulationTick.ts                  # Per-frame stepping transition logic
    types.ts                           # Canonical shared simulation/domain types
    useDraftEditPolicy.ts              # Stopped-world draft edit policy
    useSimulationLoop.ts               # RAF lifecycle and loop orchestration
    useEditPresetCommands.ts           # User preset edit dialog state and edit-confirm commands
    useSavePresetCommands.ts           # User preset save dialog state and save-confirm commands
    useSimulationSession.ts            # Session command handlers (start/reset/step/apply)
    useUserPresetCommands.ts           # User preset command composition + delete/fallback handling
    vector.ts                          # Vector utilities
    worldState.ts                      # Canonical stopped-world constructors
  ui/                                  # UI components, dialogs, and hooks
    CanvasDiagnostics.tsx              # Diagnostics panel
    ControlPanel.tsx                   # Control panel composition
    EditProfileDialog.tsx              # Edit-profile modal
    SaveProfileDialog.tsx              # Save-profile modal
    controlPanel/                      # Control panel sections and shared inputs
      BodyConfigurationSection.tsx     # Body mass/position/velocity editors
      PresetsSection.tsx               # Preset selection/apply/random/save controls
      SimulationParametersSection.tsx  # Global sim parameter controls
      StepperNumberInput.tsx           # Shared numeric input with stepping/precision behavior
      numberInputPrecision.ts          # Decimal precision helper for control-panel number inputs
      types.ts                         # Shared control-panel prop types
    diagnostics/                       # Diagnostics-specific display components
      BodyDiagnosticsColumn.tsx        # Per-body diagnostics column component
      DiagnosticsSummaryColumn.tsx     # Aggregate diagnostics summary component
      styles.ts                        # Diagnostics layout/style constants
    stage/                             # Stage controls, HUD, and hover overlays
      HoverTooltip.tsx                 # Hover tooltip overlay
      StageControls.tsx                # Run/reset/step controls and alerts
      StageHud.tsx                     # Status strip and panel toggle
    uiPrefsStorage.ts                  # UI open-state persistence helpers
    useAppPersistence.ts               # App-level persistence side effects
    useAppUiPreferences.ts             # App UI preference state initialization and setters
    useAppRuntimeState.ts              # App runtime refs + manual-mode sync glue
    useCanvasCameraControls.ts         # Pointer/touch/wheel camera interactions
    useHoverTooltipState.ts            # Hover tooltip lifecycle/state hook
    useSimulationHotkeys.ts            # Keyboard shortcut handling
    useStageViewport.ts                # Canvas container/viewport sizing hook
tests/                                 # Automated test suites
  unit/                                # Unit tests by feature area
    sim/                               # Unit tests for simulation modules
      camera.test.ts                   # Unit tests for camera transforms and updates
      cameraPolicy.test.ts             # Unit tests for auto-camera policy behavior
      diagnosticFormatting.test.ts     # Unit tests for diagnostics text formatting
      diagnosticsSelectors.test.ts     # Unit tests for diagnostics selectors
      ejection.test.ts                 # Unit tests for ejection detection logic
      hoverDiagnostics.test.ts         # Unit tests for hover diagnostics selectors
      integrators.test.ts              # Unit tests for velocity Verlet integration
      physics.test.ts                  # Unit tests for accelerations/energy/momentum
      profileValidation.test.ts        # Unit tests for saved profile validation rules
      sessionTransitions.test.ts       # Unit tests for runtime transition helpers
      simulationPolicies.test.ts       # Unit tests for simulation policy helpers
      simulationTick.test.ts           # Unit tests for per-step simulation updates
      stageSelectors.test.ts           # Unit tests for stage status selector helpers
      vector.test.ts                   # Unit tests for vector utility functions
      worldState.test.ts               # Unit tests for stopped-world construction helpers
    ui/                                # Unit tests for UI modules
      controlPanel/                    # Unit tests for control-panel helpers
        numberInputPrecision.test.ts   # Unit tests for decimal precision parsing/clamping
docs/                                  # Project docs and static doc assets
  3BodySim.png                         # Screenshot image
  README.md                            # Project documentation (this file)
  ARCHITECTURE.md                      # Detailed project structure and architecture notes
```
