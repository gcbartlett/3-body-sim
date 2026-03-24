[![Version](https://img.shields.io/github/v/tag/gcbartlett/3-body-sim?label=Latest%20Version&filter=20*%2Bg*&logo=github)](https://github.com/gcbartlett/3-body-sim/tags)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-blue?logo=vercel)](https://3-body-sim.vercel.app/)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?logo=buy-me-a-coffee)](https://buymeacoffee.com/gcbartlett)

# Three-Body Simulator

Interactive 2D Newtonian three-body simulator built with React + TypeScript + Vite.  
The app renders three gravitating bodies on a canvas with trails, diagnostics, presets, and runtime controls for camera and integration speed.

![Three-Body Simulator screenshot](./3BodySim.png)

## Features

- Velocity Verlet integration with softened gravity
- Live controls for masses, initial positions/velocities, `G`, `dt`, speed, softening, and trail fade
- Built-in presets (Figure Eight, Lagrange Triangle, Chaotic Slingshot, Trojan L4, Euler Collinear, Custom)
- User profile save/load (persisted in `localStorage`)
- Random initial condition generators (`Random Stable`, `Random Chaotic`)
- Ejection detection and dissolution detection with auto-pause
- Diagnostics for energy/momentum drift, pair energies, and per-body kinematics
- Camera lock modes (`None`, `COM`, `Origin`) plus manual pan/zoom

## Tech Stack

- React 19
- TypeScript 5.9
- Vite 8
- Vercel Web Analytics (`@vercel/analytics/react`)
- Vercel Speed Insights (`@vercel/speed-insights/react`)

## Versioning

Builds use a short CalVer derived from Git commit metadata: `YYYY.MM.DD+g<shortSha>`, auto-updated when commits change.

## Analytics

The app includes Vercel Web Analytics and Vercel Speed Insights to track high-level usage and real-user performance trends in deployed environments.
This helps monitor behavior and identify regressions after releases.

### Privacy Note

- This repository uses `@vercel/analytics/react` via `<Analytics />` in `src/main.tsx`.
- This repository uses `@vercel/speed-insights/react` via `<SpeedInsights />` in `src/main.tsx`.
- The app does not send custom analytics events or user identifiers from application code.
- User-created simulation settings/presets are stored locally in browser `localStorage` and are not sent to a backend by this app.
- If you deploy a public instance, review your host privacy disclosures and Vercel Analytics settings before launch.

## Getting Started

### Runtime and demo options

This app runs entirely in the browser with no server/backend component, so local development (`npm run dev`) is the primary way to run it.
For a live demo, you can also use the Vercel deployment at `https://3-body-sim.vercel.app/`, subject to project usage limits.
Vercel automatically rebuilds and redeploys when the GitHub repository (`https://github.com/gcbartlett/3-body-sim`) is updated, so the live demo stays on the latest version.

### Prerequisites

- Node.js `20.19+` or `22.12+`
- TypeScript language baseline: `ES2022` (for type-checking/editor support)
- Modern browsers matching Vite's default build target (`baseline-widely-available`): Chrome `111+`, Edge `111+`, Firefox `114+`, Safari/iOS Safari `16.4+`

### Install

```bash
npm install
```

### npm scripts

- `npm run dev`: start the Vite development server
- `npm run build`: type-check `src`, then create a production build with Vite
- `npm run preview`: serve the production build locally
- `npm run lint`: run ESLint checks
- `npm run lint:fix`: run ESLint and auto-fix where possible
- `npm run test`: run the Vitest suite once
- `npm run test:verbose`: run Vitest with the verbose reporter
- `npm run test:coverage`: run Vitest with coverage output

### Tests

Unit tests live under `tests/unit/`, mirroring feature areas from `src/` when practical.
Tests may import app modules via the `~` alias (for example `~/src/sim/physics`), which resolves from the repository root.

## Controls

### Simulation

- `Start / Pause / Resume` to control time evolution
- `Step` to advance one integration step
- `Reset` to reset to current initial conditions

### Keyboard shortcuts

- `+` or `=` or numpad `+`: increase simulation rate
- `-` or `_` or numpad `-`: decrease simulation rate
- `L`: cycle lock mode (`None -> COM -> Origin`)
- `Esc`: exit manual pan/zoom mode

### Canvas interaction

- Mouse drag (manual mode): pan
- Mouse wheel (manual mode): zoom
- Touch drag / pinch (manual mode): pan / zoom
- Double-click canvas: return to auto camera mode
- Hover near a body: show body tooltip diagnostics

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
    canvasRenderer.ts                  # Canvas drawing and trail rendering
  sim/                                 # Simulation domain logic and policies
    camera.ts                          # Camera transforms and tracking helpers
    cameraPolicy.ts                    # Auto-camera framing and lock-mode policy
    defaults.ts                        # Default bodies/params/world
    diagnosticFormatting.ts            # Shared diagnostics text formatting
    ejection.ts                        # Ejection metrics and detection
    hoverDiagnostics.ts                # Hover tooltip diagnostic assembly
    integrators.ts                     # Velocity Verlet stepper
    physics.ts                         # Accelerations, COM, energy, momentum
    presetStorage.ts                   # localStorage load/save/sanitize for params/presets/UI prefs
    presets.ts                         # Built-in preset profiles
    profileValidation.ts               # Saved profile validation and id/name rules
    randomProfiles.ts                  # Random stable/chaotic body generators
    sessionTransitions.ts              # Runtime world transition helpers
    diagnosticsSelectors.ts            # Diagnostics view-model selectors/helpers
    simulationPolicies.ts              # Shared runtime policy constants/helpers
    stageSelectors.ts                  # Stage status/bound-pair labeling selectors
    simulationTick.ts                  # Per-frame stepping transition logic
    types.ts                           # Canonical shared simulation/domain types
    useDraftEditPolicy.ts              # Stopped-world draft edit policy
    useSimulationLoop.ts               # RAF lifecycle and loop orchestration
    useSimulationSession.ts            # Session command handlers (start/reset/step/apply)
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
    useCanvasCameraControls.ts         # Pointer/touch/wheel camera interactions
    useHoverTooltipState.ts            # Hover tooltip lifecycle/state hook
    useSaveProfileDraft.ts             # Save-profile draft state hook
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
      integrators.test.ts              # Unit tests for velocity Verlet integration
      physics.test.ts                  # Unit tests for accelerations/energy/momentum
      profileValidation.test.ts        # Unit tests for saved profile validation rules
      sessionTransitions.test.ts       # Unit tests for runtime transition helpers
      simulationPolicies.test.ts       # Unit tests for simulation policy helpers
      simulationTick.test.ts           # Unit tests for per-step simulation updates
      stageSelectors.test.ts           # Unit tests for stage status selector helpers
      vector.test.ts                   # Unit tests for vector utility functions
    ui/                                # Unit tests for UI modules
      controlPanel/                    # Unit tests for control-panel helpers
        numberInputPrecision.test.ts   # Unit tests for decimal precision parsing/clamping
docs/                                  # Project docs and static doc assets
  3BodySim.png                         # Screenshot image
  README.md                            # Project documentation (this file)
```

## Current Scope

- Planar (2D) simulation only
- Exactly three bodies
- No backend; everything runs in-browser

## License

This project is licensed under the MIT License. See `LICENSE` at the repository root.

## Contributing and Support

- Contributing guide: `CONTRIBUTING.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`
- Security reporting: `SECURITY.md`

### ☕ Support This Project

If you find this project useful, consider supporting its development:

👉 https://buymeacoffee.com/gcbartlett

It helps with maintenance, improvements, and new features.

### Maintenance Expectations

This project is maintained on a best-effort basis.
There is no guaranteed response or fix SLA for issues or pull requests.
