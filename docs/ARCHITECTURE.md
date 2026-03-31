# Architecture

This document contains the detailed project structure map.

## Simulation Notes

- The simulation models point-mass Newtonian gravity with a softened force law for numerical stability at close approaches.
- World progression is deterministic per step and supports run, pause, single-step forward, and snapshot-based step-back.
- Session transitions (reset, preset apply, random profile generation) rebuild a consistent stopped world state and baseline diagnostics.
- History depth is user-configurable and intended for precise frame-by-frame rewind workflows.
- Camera behavior supports unlocked tracking, center-of-mass lock, and origin lock, with manual pan/zoom override.
- Auto-camera reframing uses the same damping policy across lock modes and fast-reframe-triggering transitions (reset/load/lock/manual exit), while accounting for top overlay occlusion when framing bodies.
- Stage viewport sizing reserves measured bottom diagnostics inset, while top overlay inset informs camera framing bias.
- Diagnostics are optimized for two use cases: low overhead while running and frame-accurate inspection while paused.
- Trail rendering is optimized for visual continuity/readability and runtime cost while preserving history fidelity for rewind.

## Performance Monitoring

Performance monitoring is optional and prints summarized metrics to the browser console in periodic windows.

### How to enable

- URL flag: add `?perf=1` (disable with `?perf=0`).
- Local storage flag: `localStorage.setItem("threeBodyPerf", "1")` (disable with `"0"`).
- Query flag takes precedence over local storage when both are present.

### What gets reported

- Duration segments (timing distributions): `count`, `avgMs`, `p95Ms`, `p99Ms`, `maxMs`.
- Counters (event throughput): total `count` and derived `perSecond`.
- Gauges (latest sampled value): current numeric state at flush time.
- React render profiling: per-component render durations and commit counts.
- JS heap gauges (when browser APIs are available): used heap, heap limit, and used/limit ratio.

### Current metric families

- RAF and frame lifecycle
- Simulation stepping and camera updates
- Canvas render phases (including trails/history paths)
- React publish cadence and throttling
- Diagnostics and history publication behavior
- Pointer/hover/layout observer activity
- React component render commits and timings

### Metric catalog

| Metric name | Type | Description / what it is useful for tracking |
| --- | --- | --- |
| `diagnostics.publish.calls` | Counter | Number of diagnostics publishes; use to verify active diagnostics publish cadence. |
| `diagnostics.publish.immediate` | Counter | Immediate (non-throttled) diagnostics publishes; useful for paused/forced publish validation. |
| `diagnostics.publish.throttled` | Counter | Deferred diagnostics publishes; useful for confirming throttling pressure while running. |
| `history.captureAndPush` | Duration | Time to capture and push history snapshot in-loop; tracks rewind-history overhead in frame budget. |
| `history.captureSnapshot` | Duration | Snapshot capture cost; useful for assessing per-step snapshot serialization overhead. |
| `history.cloneTrailMap` | Duration | Trail-map clone cost during snapshot creation; useful for trail-history overhead. |
| `history.cloneTrailMap.points` | Gauge | Number of trail points cloned; useful for correlating clone cost with trail size. |
| `history.metrics.compute` | Duration | Time to compute history metrics object; tracks history-metrics calculation overhead. |
| `history.metrics.publish.calls` | Counter | History metrics publishes that changed state; useful for effective UI update rate. |
| `history.metrics.publish.skipped` | Counter | History metrics publishes skipped due to no state change; useful for duplicate-update suppression. |
| `history.metrics.publish.throttled` | Counter | History metrics publishes deferred by cadence control; useful for throttling behavior. |
| `history.onHistoryChanged.calls` | Counter | Number of history-changed notifications emitted; useful for event fan-out visibility. |
| `history.pushSnapshot.calls` | Counter | Number of snapshot pushes attempted; tracks rewind buffer write frequency. |
| `history.pushSnapshot.shifted` | Counter | Number of history pushes that evicted oldest snapshot; useful for capacity pressure. |
| `history.snapshot.count` | Gauge | Current snapshot count in history buffer; useful for rewind depth occupancy. |
| `hover.computeAccelerations` | Duration | Time to compute per-body accelerations for hover diagnostics; tracks hover detail cost. |
| `hover.computeAccelerations.calls` | Counter | Number of acceleration computations; useful for hover diagnostics activity level. |
| `hover.refresh` | Duration | Duration of periodic hover refresh in frame loop; tracks recurring tooltip refresh cost. |
| `hover.refresh.calls` | Counter | Number of periodic hover refreshes in frame loop; useful for refresh cadence checks. |
| `hover.refreshById.success` | Counter | Successful hover refresh-by-id updates; useful for tooltip refresh reliability. |
| `hover.refreshById.total` | Duration | End-to-end refresh-by-id handling time; tracks hover refresh callback latency. |
| `hover.update.success` | Counter | Successful hover updates from pointer interactions; useful for hover hit/flow validation. |
| `hover.update.total` | Duration | End-to-end hover update processing time; tracks pointer-hover processing overhead. |
| `js.heap.limit` | Gauge | JavaScript heap limit (if available); useful as context for memory headroom. |
| `js.heap.used` | Gauge | JavaScript heap usage (if available); useful for memory growth/churn monitoring. |
| `js.heap.usedRatio` | Gauge | Heap usage ratio (`used/limit`); useful for relative memory pressure tracking. |
| `layout.canvasDiagnostics.emit` | Counter | Number of diagnostics panel height emissions; useful for layout communication frequency. |
| `layout.canvasDiagnostics.measure` | Duration | Time to measure diagnostics panel height; tracks diagnostics layout read cost. |
| `layout.canvasDiagnostics.resizeObserver.callback` | Counter | ResizeObserver callbacks for diagnostics panel; useful for resize activity visibility. |
| `layout.diagnosticsInset.changed` | Counter | Diagnostics inset updates that changed state; useful for real layout-shift count. |
| `layout.diagnosticsInset.unchanged` | Counter | Diagnostics inset updates that were no-ops; useful for redundant update detection. |
| `layout.diagnosticsInset.value` | Gauge | Current diagnostics inset height; useful for stage usable-area context. |
| `layout.stageViewport.changed` | Counter | Stage viewport dimension updates that changed state; useful for real viewport change count. |
| `layout.stageViewport.rectUpdates` | Counter | Raw viewport rect reads/updates processed; useful for resize processing frequency. |
| `layout.stageViewport.resizeObserver.callback` | Counter | ResizeObserver callbacks for stage viewport; useful for container resize activity. |
| `layout.stageViewport.unchanged` | Counter | Viewport updates that were no-ops; useful for redundant layout event noise. |
| `pointer.move.events` | Counter | Pointer move events seen by canvas controls; useful for input intensity and sampling rate. |
| `pointer.move.rectReads` | Counter | Bounding-rect reads during pointer move handling; useful for DOM read pressure. |
| `pointer.wheel.events` | Counter | Wheel events processed; useful for zoom interaction volume. |
| `raf.requestRender.calls` | Counter | Explicit paused/invalidation render requests; useful for redraw trigger volume while idle. |
| `raf.skip.noCanvas` | Counter | RAF ticks skipped due to missing canvas element; useful for lifecycle/setup diagnostics. |
| `raf.skip.noContext` | Counter | RAF ticks skipped due to missing 2D context; useful for canvas context availability issues. |
| `raf.tick.calls` | Counter | Total RAF ticks processed; useful for effective frame loop activity rate. |
| `raf.tick.idleStops` | Counter | Number of times RAF loop stopped in idle mode; useful for paused loop stop behavior. |
| `raf.tick.total` | Duration | End-to-end RAF tick duration; primary per-frame CPU budget metric. |
| `react.render.{id}.actual` | Duration | React Profiler actual render duration for component/profile id; useful for real render work. |
| `react.render.{id}.base` | Duration | React Profiler base duration for component/profile id; useful for memoization/reference cost baseline. |
| `react.render.{id}.commits` | Counter | React commit count for component/profile id; useful for render frequency by subtree. |
| `react.render.{id}.{phase}` | Counter | React phase count (`mount`/`update`) by profile id; useful for mount/update mix analysis. |
| `react.worldPublish.calls` | Counter | React world publishes performed; useful for state publish cadence verification. |
| `react.worldPublish.throttled` | Counter | World publishes skipped/deferred by cadence; useful for throttling effectiveness. |
| `render.drawFrame` | Duration | Canvas draw orchestration time per frame; tracks rendering share of frame cost. |
| `render.trail.points.deduped` | Gauge | Number of trail points removed by dedupe in current window; useful for trail optimization effect. |
| `render.trail.points.dedupePct` | Gauge | Percent of renderable trail points deduped; useful for tuning dedupe threshold/zoom behavior. |
| `render.trail.points.nonConsecutiveNearOverlapEstimate` | Gauge | Approximate non-consecutive near-overlap count in trails; useful for spotting overlap-heavy paths. |
| `render.trail.points.renderable` | Gauge | Renderable trail point count before dedupe; useful for trail rendering workload size. |
| `sim.camera` | Duration | Camera policy/update computation time; useful for camera overhead tracking. |
| `sim.step` | Duration | Simulation stepping computation time; primary physics/update cost metric. |
| `sim.stepsAdvanced` | Gauge | Number of simulation steps advanced in frame; useful for backlog and rate behavior. |
| `sim.trails.fadePrune` | Duration | Time to fade/prune trail data; useful for trail maintenance overhead tracking. |

## Persistence

The app stores UI and user data in browser `localStorage`, including:

- Simulation parameters
- User-created preset profiles
- Panel expanded/collapsed state
- Control section open states
- Diagnostics panel open state

### Persistence data catalog

| Storage key | Value shape | Description / what it is useful for |
| --- | --- | --- |
| `three-body-sim.params.v1` | JSON object (`SimParams`) | Persisted simulation parameters (`G`, `dt`, `speed`, `softening`, `trailFade`) so sessions reopen with the same runtime tuning. |
| `three-body-sim.user-presets.v1` | JSON array (`PresetProfile[]`) | User-defined preset library (id/name/description + bodies + params); preserves custom scenarios between visits. |
| `three-body-sim.ui.panel-expanded.v1` | `"1"` or `"0"` | Control panel expanded/collapsed preference; keeps preferred workspace layout. |
| `three-body-sim.ui.lock-mode.v1` | `"none"` / `"com"` / `"origin"` | Camera lock-mode preference; restores expected camera behavior on load. |
| `three-body-sim.ui.show-origin-marker.v1` | `"1"` or `"0"` | Origin marker visibility preference; keeps overlay display consistent across sessions. |
| `three-body-sim.ui.show-grid.v1` | `"1"` or `"0"` | Grid visibility preference; preserves stage visual context preference. |
| `three-body-sim.ui.show-center-of-mass.v1` | `"1"` or `"0"` | Center-of-mass marker visibility preference; preserves diagnostics overlay preference. |
| `three-body-sim.ui.sections.v1` | JSON object (`SectionOpenState`) | Control-panel section open/closed state (`presetsOpen`, `simParamsOpen`, `bodyConfigOpen`) to preserve editing workflow state. |
| `three-body-sim.ui.canvas-diagnostics.v1` | `"1"` or `"0"` | Canvas diagnostics panel open/closed state; restores diagnostics visibility preference. |
| `three-body-sim.ui.app-liked.v1` | `"1"` or `"0"` | App-like/thumb state (if used by UI flow); preserves user sentiment/action state. |
| `threeBodyPerf` | `"1"` or `"0"` | Perf-monitor enable flag used by runtime diagnostics logging; useful for persistent local profiling without query params. |

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
    diagnosticsPublishPolicy.ts        # Two-mode diagnostics publish decision helper
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
      trailLayer.test.ts               # Unit tests for trail dedupe and segment rendering behavior
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
      canvasDiagnostics.test.ts        # Unit tests for diagnostics layout inset helpers
      sponsorPage.test.ts              # Unit tests for sponsor window-opening behavior
      stageControls.test.tsx           # Unit tests for stage controls hold acceleration/disabled back state
      uiPrefsStorage.test.ts           # Unit tests for UI preference persistence helpers
      useAppRuntimeState.test.ts       # Unit tests for manual-mode transition callback semantics
      useAppViewModels.test.ts         # Unit tests for app-level stage/diagnostic view-model assembly
      diagnosticsPublishPolicy.test.ts # Unit tests for diagnostics publish cadence decisions
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
