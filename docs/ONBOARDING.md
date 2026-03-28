# 3-Body Simulator Onboarding Guide

## Big-picture mental model

This is a pure frontend app (React + TypeScript + Vite) that simulates exactly three gravitational bodies in 2D and draws them on an HTML canvas. There is no backend; runtime state lives in React state/refs, and persistence is local browser storage.

The architecture is intentionally split into:

- `src/sim` → physics + simulation lifecycle/business rules
- `src/render` → canvas drawing pipeline
- `src/ui` → React components and hooks for controls, diagnostics, dialogs
- `tests/unit` → unit tests by feature area

## General structure (how files fit together)

### 1) App composition root (`src/App.tsx`)

`App.tsx` wires everything together: persisted params/presets, world state, camera refs, hotkeys, simulation loop, session commands, and UI view-model props. It is the central orchestrator.

It renders:

- left control panel
- stage/HUD/controls/diagnostics/canvas
- save/edit preset dialogs

### 2) Simulation loop and frame pipeline

`useSimulationLoop` runs `requestAnimationFrame`, computes `dtReal`, calls `runSimulationFrame`, captures snapshots when steps advance, then writes back next refs/state.

`runSimulationFrame` does the per-frame engine work:

1. advance world state (`advanceRunningWorldStep`)
2. recompute camera (unless manual pan/zoom)
3. fade trails + draw frame
4. refresh hover diagnostics on interval

### 3) Stepping policy and physics progression

`advanceRunningWorldStep` handles simulation speed scaling, effective dt, frame-step caps, trail sampling cadence, ejection checks, and dissolution progression. This is a key file for behavior tuning/performance.

### 4) Session transitions / user commands

`useSimulationSession` collects handlers for Start/Pause/Reset/Step/Preset actions and delegates transition logic to pure helpers. This keeps UI event handlers clean.

`sessionTransitions.ts` contains deterministic transition builders for reset/start-pause/single-step/step-back, including baseline diagnostics reset, snapshot restore, and world replacement.

### 5) History and rewind state

`simulationHistory.ts` is the canonical rewind storage module. It owns snapshot capture/restore shapes, history depth clamping, and usage metrics for UI display.

### 6) Rendering layer

`canvasRenderer.ts` is simple and layered: grid → trails → bodies → overlay, plus trail fade/prune logic. Good place to start for visual changes.

### 7) Stage controls and hotkeys

`StageControls.tsx` and `useSimulationHotkeys.ts` implement transport controls (`Back`, `Start/Pause`, `Step`, `Reset`) including hold-to-accelerate stepping behavior.

`stepAcceleration.ts` centralizes hold acceleration thresholds and burst policy shared by keyboard and pointer interactions.

### 8) Persistence and sanitization

Persistence writes to `localStorage` with versioned keys for params, presets, and UI prefs.

`presetStorageCodecs.ts` sanitizes numeric ranges, validates lock modes, enforces exactly 3 bodies for stored presets, and normalizes/sanitizes preset IDs/names/descriptions. This is where data integrity is protected.

## Important things to know as a newcomer

- Canonical domain types live in `src/sim/types.ts` (`SimParams`, `WorldState`, `BodyState`, `LockMode`). Understand these first; they define what state means everywhere else.
- The app assumes exactly three bodies (defaults, presets, sanitization, and UI all reinforce this).
- Defaults are centralized in `src/sim/defaults.ts`, so starting conditions and baseline params are easy to find/change.
- Snapshot-backed rewind is part of normal runtime behavior; history depth and memory usage are surfaced in stage controls.
- Step controls and Arrow Left/Right both use hold acceleration with shared thresholds (`src/ui/stepAcceleration.ts`).
- `main.tsx` includes Vercel analytics/speed insights in the render tree, so production telemetry is part of startup.
- Tooling/scripts are straightforward: `dev`, `build`, `test`, `lint`, etc., with modern Node/TS/Vite versions.

## What to learn next (practical path)

If I were onboarding, I’d do this in order:

1. Read `src/sim/types.ts` and `src/sim/defaults.ts` to internalize the data model and default world.
2. Trace runtime from `App.tsx` → `useSimulationLoop.ts` → `simulationFrame.ts` → `simulationTick.ts` to understand the full execution pipeline.
3. Read `sessionTransitions.ts` + `useSimulationSession.ts` + `simulationHistory.ts` to learn how user actions map to deterministic world changes and rewind snapshot behavior.
4. Read `canvasRenderer.ts` + `render/layers/*` to learn visual composition boundaries.
5. Study tests in `tests/unit/sim/` (especially `simulationTick.test.ts`) to see expected behavior and edge cases (caps, sampling cadence, pause behavior).

## First 90 minutes onboarding checklist

Use this as a timed, practical walkthrough. Open each file, answer the listed questions in your own notes, and keep moving.

### 0-10 min: repo orientation and run commands

- File: `docs/README.md`
  - Questions:
    1. What is in scope for this app (and what is explicitly out of scope)?
    2. Which controls and runtime features are user-facing?
    3. Which npm scripts are most relevant for day-to-day development?
- File: `package.json`
  - Questions:
    1. What Node versions are supported?
    2. Which script should you run for local development vs. production build?
    3. Which dependencies are runtime vs. development-only?

### 10-25 min: data model and defaults

- File: `src/sim/types.ts`
  - Questions:
    1. What fields make up `WorldState`, and which represent transient runtime flags?
    2. Which fields in `SimParams` directly affect numerical behavior?
    3. What lock modes are legal, and how is validity checked?
- File: `src/sim/defaults.ts`
  - Questions:
    1. What are the initial bodies and parameter defaults?
    2. Where does initial world creation happen?
    3. If you changed defaults, what downstream UI/simulation behavior would change first?

### 25-40 min: top-level wiring and user intent flow

- File: `src/App.tsx`
  - Questions:
    1. Which state is React state, and which values are kept in refs for the animation loop?
    2. Where do persistence side effects happen?
    3. How are `ControlPanel`, stage components, and dialogs wired to command handlers?
- File: `src/sim/useSimulationSession.ts`
  - Questions:
    1. Which handlers map to start/pause/reset/step/preset/random actions?
    2. Which transitions are delegated to pure helper modules?
    3. What responsibilities stay here vs. in UI components?

### 40-60 min: simulation frame pipeline + rewind history

- File: `src/sim/useSimulationLoop.ts`
  - Questions:
    1. How is `requestAnimationFrame` lifecycle managed?
    2. How is real-time delta (`dtReal`) computed?
    3. Under what condition are history snapshots captured vs. `setWorld` updates applied?
- File: `src/sim/simulationFrame.ts`
  - Questions:
    1. In what exact order are stepping, camera updates, and drawing executed?
    2. When does manual pan/zoom bypass auto-camera?
    3. How often does hover tooltip refresh occur, and why might that matter?
- File: `src/sim/simulationTick.ts`
  - Questions:
    1. How does `speed` alter effective dt and max steps per frame?
    2. Where are ejection and dissolution checks applied in the step loop?
    3. How is backlog clamped to avoid runaway catch-up?
- File: `src/sim/simulationHistory.ts`
  - Questions:
    1. Which runtime fields are included in each snapshot (world, trails, accumulator, counters)?
    2. How are history depth and retained snapshots clamped/pruned?
    3. How is estimated history memory usage derived?

### 60-75 min: controls and hold acceleration

- File: `src/ui/stepAcceleration.ts`
  - Questions:
    1. What hold durations map to burst sizes?
    2. Which constants are shared between keyboard and pointer acceleration?
    3. If acceleration feels too aggressive, which thresholds would you tune first?
- File: `src/ui/stage/StageControls.tsx`
  - Questions:
    1. How is hold state started/stopped for `Back` and `Step`?
    2. How is accidental post-hold click suppression handled?
    3. Where are history depth controls and usage metrics rendered?
- File: `src/ui/useSimulationHotkeys.ts`
  - Questions:
    1. Which guards prevent hotkeys from firing in inputs/interactive elements?
    2. How are hold intervals started/stopped for Arrow Left/Right?
    3. How is acceleration state emitted to the HUD layer?

### 75-85 min: rendering and persistence safety

- File: `src/render/canvasRenderer.ts`
  - Questions:
    1. What is the layer draw order and why does it matter visually?
    2. How are trails faded/pruned over time?
    3. If you add a new visual overlay, where should it be inserted?
- File: `src/sim/presetStorage.ts`
  - Questions:
    1. Which `localStorage` keys are used for params, UI preferences, and user presets?
    2. Where are storage failures intentionally swallowed?
    3. Which save/load calls are expected to be invoked by app-level hooks?
- File: `src/sim/presetStorageCodecs.ts`
  - Questions:
    1. Which numeric and structural sanitization constraints are enforced?
    2. How are malformed/duplicate user presets handled?
    3. Why is body-array validation strict about length?

### 85-90 min: invariants through tests

- File: `tests/unit/sim/simulationTick.test.ts`
  - Questions:
    1. Which behaviors are explicitly guaranteed by tests (pause behavior, backlog cap, trail sampling)?
    2. Which mocks isolate simulation tick from integrator/ejection internals?
    3. What additional edge case would you test before changing stepping policy?
- File: `tests/unit/sim/sessionTransitions.test.ts`
  - Questions:
    1. Which session transitions are expected to mutate baseline diagnostics?
    2. What must remain true after reset or single-step transitions?
    3. If transition logic changes, which assertions should fail first?

### Stretch follow-up (after 90 min)

1. Run `npm run test` and skim failing tests (if any) before changing behavior.
2. Make one tiny change (e.g., tune `trailFade` default) and trace impact from `defaults.ts` through UI and frame rendering.
3. Add or update a unit test before touching step policy constants.
