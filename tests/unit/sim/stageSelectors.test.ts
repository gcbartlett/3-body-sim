import { describe, expect, it } from "vitest";
import { boundPairStateLabel, statusLabelForWorld } from "~/src/sim/stageSelectors";

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
