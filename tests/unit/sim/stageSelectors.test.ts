import { describe, expect, it } from "vitest";
import {
  boundPairStateLabel,
  ejectedBodiesForStatus,
  latestEjectedLabelForStatus,
  stageViewModelForWorld,
  statusLabelForWorld,
} from "~/src/sim/stageSelectors";
import type { WorldState } from "~/src/sim/types";

const makeWorld = (overrides: Partial<WorldState> = {}): WorldState => ({
  bodies: [
    {
      id: "body-1",
      mass: 1,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      color: "#f00",
    },
    {
      id: "body-2",
      mass: 1,
      position: { x: 1, y: 0 },
      velocity: { x: 0, y: 0 },
      color: "#0f0",
    },
    {
      id: "body-3",
      mass: 1,
      position: { x: 0, y: 1 },
      velocity: { x: 0, y: 0 },
      color: "#00f",
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

describe("statusLabelForWorld", () => {
  const mode = "COM Lock";
  const pair = "Resonant";

  it('returns "Dissolved" when dissolved and not running', () => {
    const label = statusLabelForWorld(
      { dissolutionDetected: true, isRunning: false, elapsedTime: 42 },
      mode,
      pair,
    );

    expect(label).toBe("Dissolved");
  });

  it('returns "Running • ..." while running', () => {
    const label = statusLabelForWorld(
      { dissolutionDetected: false, isRunning: true, elapsedTime: 1 },
      mode,
      pair,
    );

    expect(label).toBe("Running • COM Lock • Resonant");
  });

  it('returns "Paused • ..." when stopped with elapsed time > 0', () => {
    const label = statusLabelForWorld(
      { dissolutionDetected: false, isRunning: false, elapsedTime: 3.5 },
      mode,
      pair,
    );

    expect(label).toBe("Paused • COM Lock • Resonant");
  });

  it('returns "Ready • ..." for initial stopped state', () => {
    const label = statusLabelForWorld(
      { dissolutionDetected: false, isRunning: false, elapsedTime: 0 },
      mode,
      pair,
    );

    expect(label).toBe("Ready • COM Lock • Resonant");
  });
});

describe("boundPairStateLabel", () => {
  it('returns "Dissolved" override when dissolutionDetected=true', () => {
    const label = boundPairStateLabel({ state: "resonant", nbound: 2 }, true);

    expect(label).toBe("Dissolved");
  });

  it("maps displayPairState.state values to stage labels", () => {
    expect(boundPairStateLabel({ state: "dissolving", nbound: 0 }, false)).toBe("Dissolving");
    expect(boundPairStateLabel({ state: "binary+single", nbound: 1 }, false)).toBe("Binary+Single");
    expect(boundPairStateLabel({ state: "resonant", nbound: 2 }, false)).toBe("Resonant");
  });
});

describe("stageViewModelForWorld", () => {
  it("maps run-button copy to Start/Resume/Pause from running and elapsed state", () => {
    const pairStateLabel = "Resonant";
    const bodyColors = ["#a", "#b", "#c"];

    const startView = stageViewModelForWorld({
      world: makeWorld({ isRunning: false, elapsedTime: 0 }),
      lockMode: "com",
      manualPanZoom: false,
      bodyColors,
      pairStateLabel,
    });
    const resumeView = stageViewModelForWorld({
      world: makeWorld({ isRunning: false, elapsedTime: 5 }),
      lockMode: "com",
      manualPanZoom: false,
      bodyColors,
      pairStateLabel,
    });
    const pauseView = stageViewModelForWorld({
      world: makeWorld({ isRunning: true, elapsedTime: 2 }),
      lockMode: "com",
      manualPanZoom: false,
      bodyColors,
      pairStateLabel,
    });

    expect(startView.runButtonLabel).toBe("Start");
    expect(startView.runButtonTooltip).toBe("Start running the simulation.");
    expect(resumeView.runButtonLabel).toBe("Resume");
    expect(resumeView.runButtonTooltip).toBe("Resume running the simulation.");
    expect(pauseView.runButtonLabel).toBe("Pause");
    expect(pauseView.runButtonTooltip).toBe("Pause simulation time progression.");
  });

  it('uses "Manual" status segment when manualPanZoom=true', () => {
    const view = stageViewModelForWorld({
      world: makeWorld({ isRunning: false, elapsedTime: 1 }),
      lockMode: "origin",
      manualPanZoom: true,
      bodyColors: ["#a", "#b", "#c"],
      pairStateLabel: "Resonant",
    });

    expect(view.statusLabel).toBe("Paused • Manual • Resonant");
  });
});

describe("ejectedBodiesForStatus", () => {
  it("maps known ids to B{index} and applies color fallback for missing bodyColors", () => {
    const world = makeWorld({ ejectedBodyIds: ["body-2", "missing-id"] });
    const rows = ejectedBodiesForStatus(world, ["#111"]);

    expect(rows).toEqual([
      { id: "body-2", label: "B2", color: "#d1d5db" },
      { id: "missing-id", label: "missing-id", color: "#d1d5db" },
    ]);
  });
});

describe("latestEjectedLabelForStatus", () => {
  it("returns mapped label for known id and raw id for unknown", () => {
    const known = latestEjectedLabelForStatus(makeWorld({ ejectedBodyId: "body-3" }));
    const unknown = latestEjectedLabelForStatus(makeWorld({ ejectedBodyId: "unknown-id" }));

    expect(known).toBe("B3");
    expect(unknown).toBe("unknown-id");
  });
});
