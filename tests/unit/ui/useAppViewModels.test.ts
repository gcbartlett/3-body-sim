import { describe, expect, it, vi } from "vitest";
import { useAppViewModels } from "~/src/ui/useAppViewModels";
import type { DiagnosticsSnapshot, SimParams, WorldState } from "~/src/sim/types";

const makeWorld = (overrides: Partial<WorldState> = {}): WorldState => ({
  bodies: [
    {
      id: "a",
      mass: 1,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      color: "#f00",
    },
    {
      id: "b",
      mass: 1,
      position: { x: 1, y: 0 },
      velocity: { x: 0, y: 0 },
      color: "#0f0",
    },
  ],
  elapsedTime: 0,
  isRunning: false,
  ejectionCounterById: {},
  ejectedBodyId: null,
  ejectedBodyIds: [],
  dissolutionCounterSec: 0,
  dissolutionDetected: false,
  dissolutionJustDetected: false,
  ...overrides,
});

const makeParams = (): SimParams => ({
  G: 1,
  dt: 0.01,
  speed: 1,
  softening: 0.001,
  trailFade: 0.02,
});

const diagnostics: DiagnosticsSnapshot = {
  energy: 0,
  momentum: { x: 0, y: 0 },
};

describe("useAppViewModels", () => {
  it("forwards Back-control props from app wiring to StageControls", () => {
    const onStepBack = vi.fn();
    const result = useAppViewModels({
      world: makeWorld(),
      params: makeParams(),
      panelExpanded: true,
      lockMode: "none",
      manualPanZoom: false,
      bodyColors: ["#f00", "#0f0", "#00f"],
      baselineDiagnostics: diagnostics,
      diagnostics,
      onStartPause: vi.fn(),
      onReset: vi.fn(),
      onStep: vi.fn(),
      onStepBack,
      canStepBack: true,
      onTogglePanelExpanded: vi.fn(),
      onVisibleHeightChange: vi.fn(),
    });

    expect(result.stageControlsProps.onStepBack).toBe(onStepBack);
    expect(result.stageControlsProps.canStepBack).toBe(true);
  });

  it("forwards disabled Back-control state when canStepBack is false", () => {
    const onStepBack = vi.fn();
    const result = useAppViewModels({
      world: makeWorld(),
      params: makeParams(),
      panelExpanded: true,
      lockMode: "none",
      manualPanZoom: false,
      bodyColors: ["#f00", "#0f0", "#00f"],
      baselineDiagnostics: diagnostics,
      diagnostics,
      onStartPause: vi.fn(),
      onReset: vi.fn(),
      onStep: vi.fn(),
      onStepBack,
      canStepBack: false,
      onTogglePanelExpanded: vi.fn(),
      onVisibleHeightChange: vi.fn(),
    });

    expect(result.stageControlsProps.onStepBack).toBe(onStepBack);
    expect(result.stageControlsProps.canStepBack).toBe(false);
  });
});
