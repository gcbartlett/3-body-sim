# Three-Body Simulator

Interactive 2D Newtonian three-body simulator built with React + TypeScript + Vite.  
The app renders three gravitating bodies on a canvas with trails, diagnostics, presets, and runtime controls for camera and integration speed.

![Three-body screenshot](./3BodyProblem.PNG)

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

## Analytics

The app includes Vercel Web Analytics to track high-level usage and performance trends in deployed environments.
This helps monitor real-user behavior and identify regressions after releases.

### Privacy Note

- This repository uses `@vercel/analytics/react` via `<Analytics />` in `src/main.tsx`.
- The app does not send custom analytics events or user identifiers from application code.
- User-created simulation settings/presets are stored locally in browser `localStorage` and are not sent to a backend by this app.
- If you deploy a public instance, review your host privacy disclosures and Vercel Analytics settings before launch.

## Getting Started

### Prerequisites

- Node.js `20.19+` or `22.12+`

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Lint

Run ESLint checks:

```bash
npm run lint
```

Auto-fix lint issues where possible:

```bash
npm run lint:fix
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

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
src/
  App.tsx                 # Composition root and high-level wiring
  main.tsx                # React entry point
  styles.css              # Layout and visual styling
  render/
    canvasRenderer.ts     # Canvas drawing and trail rendering
  sim/
    camera.ts             # Camera transforms and tracking helpers
    cameraPolicy.ts       # Auto-camera framing and lock-mode policy
    defaults.ts           # Default bodies/params/world
    diagnosticFormatting.ts # Shared diagnostics text formatting
    ejection.ts           # Ejection metrics and detection
    hoverDiagnostics.ts   # Hover tooltip diagnostic assembly
    integrators.ts        # Velocity Verlet stepper
    physics.ts            # Accelerations, COM, energy, momentum
    presetStorage.ts      # localStorage load/save/sanitize for params/presets/UI prefs
    presets.ts            # Built-in preset profiles
    profileValidation.ts  # Saved profile validation and id/name rules
    randomProfiles.ts     # Random stable/chaotic body generators
    sessionTransitions.ts # Runtime world transition helpers
    simulationPolicies.ts # Shared runtime policy constants/helpers
    simulationSelectors.ts # Stage/diagnostics view-model selectors
    simulationTick.ts     # Per-frame stepping transition logic
    types.ts              # Canonical shared simulation/domain types
    useDraftEditPolicy.ts # Stopped-world draft edit policy
    useSimulationLoop.ts  # RAF lifecycle and loop orchestration
    useSimulationSession.ts # Session command handlers (start/reset/step/apply)
    vector.ts             # Vector utilities
    worldState.ts         # Canonical stopped-world constructors
  ui/
    CanvasDiagnostics.tsx # Diagnostics panel
    ControlPanel.tsx      # Control panel composition
    SaveProfileDialog.tsx # Save-profile modal
    controlPanel/
      BodyConfigurationSection.tsx # Body mass/position/velocity editors
      PresetsSection.tsx   # Preset selection/apply/random/save controls
      SimulationParametersSection.tsx # Global sim parameter controls
      types.ts             # Shared control-panel prop types
    stage/
      HoverTooltip.tsx     # Hover tooltip overlay
      StageControls.tsx    # Run/reset/step controls and alerts
      StageHud.tsx         # Status strip and panel toggle
    uiPrefsStorage.ts      # UI open-state persistence helpers
    useAppPersistence.ts   # App-level persistence side effects
    useCanvasCameraControls.ts # Pointer/touch/wheel camera interactions
    useHoverTooltipState.ts # Hover tooltip lifecycle/state hook
    useSaveProfileDraft.ts # Save-profile draft state hook
    useSimulationHotkeys.ts # Keyboard shortcut handling
    useStageViewport.ts    # Canvas container/viewport sizing hook
docs/
  3BodyProblem.PNG        # Screenshot image
  README.md               # Project documentation (this file)
```

## Current Scope

- Planar (2D) simulation only
- Exactly three bodies
- No backend; everything runs in-browser
