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

- React 18
- TypeScript 5
- Vite 5

## Getting Started

### Prerequisites

- Node.js 18+ (Node 20 recommended)

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
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
  App.tsx                 # App state, simulation loop, controls wiring
  styles.css              # Layout and visual styling
  render/
    canvasRenderer.ts     # Canvas drawing and trail rendering
  sim/
    physics.ts            # Accelerations, COM, energy, momentum
    integrators.ts        # Velocity Verlet stepper
    ejection.ts           # Ejection metrics and detection
    presets.ts            # Built-in preset profiles
    defaults.ts           # Default bodies/params/world
    camera.ts             # Camera transforms and tracking
    types.ts              # Shared simulation types
    vector.ts             # Vector utilities
  ui/
    ControlPanel.tsx      # Inputs and preset controls
    CanvasDiagnostics.tsx # Diagnostics panel
docs/
  3BodyProblem.PNG        # Screenshot/reference image
```

## Current Scope

- Planar (2D) simulation only
- Exactly three bodies
- No backend; everything runs in-browser
