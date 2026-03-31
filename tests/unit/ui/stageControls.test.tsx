import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StageControls,
  blurStageControlButtonOnPointerUp,
  burstCountForPointerHold,
  shouldKeepClickSuppressionAfterStop,
} from "~/src/ui/stage/StageControls";
import { HOLD_REPEAT_DELAY_MS } from "~/src/ui/stepAcceleration";

describe("StageControls", () => {
  it("renders Back button disabled when step-back is unavailable", () => {
    const html = renderToStaticMarkup(
      <StageControls
        runButtonLabel="Start"
        runButtonTooltip="Start simulation."
        onStartPause={() => {}}
        onReset={() => {}}
        onStep={() => {}}
        onStepBack={() => {}}
        canStepBack={false}
        historySnapshotCount={0}
        historyMaxSteps={300}
        historyEstimatedBytes={0}
        ejectedBodyId={null}
        latestEjectedLabel={null}
        dissolutionJustDetected={false}
      />,
    );

    expect(html).toContain("stage-control-svg");
    expect(html).toContain("BACK");
    expect(html).toContain("START");
    expect(html).toContain("STEP");
    expect(html).toContain("RESET");
    expect(html.match(/stage-control-svg/g)?.length).toBe(4);
    expect(html).toContain("disabled");
    expect(html).toContain("Hotkey: Left Arrow.");
    expect(html).toContain("Hold to accelerate.");
    expect(html).toContain("stage-history-buffer");

    const backIndex = html.indexOf("BACK");
    const startIndex = html.indexOf("START");
    const stepIndex = html.indexOf("STEP");
    const resetIndex = html.indexOf("RESET");
    expect(backIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(backIndex);
    expect(stepIndex).toBeGreaterThan(startIndex);
    expect(resetIndex).toBeGreaterThan(stepIndex);
  });

  it("renders Back button enabled when history exists", () => {
    const html = renderToStaticMarkup(
      <StageControls
        runButtonLabel="Pause"
        runButtonTooltip="Pause simulation."
        onStartPause={() => {}}
        onReset={() => {}}
        onStep={() => {}}
        onStepBack={() => {}}
        canStepBack
        historySnapshotCount={10}
        historyMaxSteps={300}
        historyEstimatedBytes={2048}
        ejectedBodyId={null}
        latestEjectedLabel={null}
        dissolutionJustDetected={false}
      />,
    );

    expect(html).toContain("stage-control-svg");
    expect(html).toContain("BACK");
    expect(html).toContain("STEP");
    expect(html).toContain("PAUSE");
    expect(html).toContain("RESET");
    expect(html.match(/stage-control-svg/g)?.length).toBe(4);
    expect(html).not.toContain("disabled");
    expect(html).toContain("Hotkey: Right Arrow.");
    expect(html).toContain("Hold to accelerate.");
    expect(html).toContain("stage-history-buffer-fill");
  });

  it("uses the same burst thresholds for pointer hold acceleration", () => {
    expect(burstCountForPointerHold(100)).toBe(0);
    expect(burstCountForPointerHold(500)).toBe(1);
    expect(burstCountForPointerHold(1000)).toBe(1);
    expect(burstCountForPointerHold(1600)).toBe(2);
    expect(burstCountForPointerHold(2600)).toBe(4);
    expect(burstCountForPointerHold(3600)).toBe(8);
    expect(burstCountForPointerHold(4800)).toBe(16);
    expect(burstCountForPointerHold(5800)).toBe(32);
  });

  it("uses HOLD_REPEAT_DELAY_MS as the no-repeat boundary for pointer hold", () => {
    expect(burstCountForPointerHold(HOLD_REPEAT_DELAY_MS - 1)).toBe(0);
    expect(burstCountForPointerHold(HOLD_REPEAT_DELAY_MS)).toBe(1);
    expect(burstCountForPointerHold(HOLD_REPEAT_DELAY_MS + 1)).toBe(1);
  });

  it("keeps click suppression only for pointer-up stop events", () => {
    expect(shouldKeepClickSuppressionAfterStop("pointer-up")).toBe(true);
    expect(shouldKeepClickSuppressionAfterStop("pointer-leave")).toBe(false);
    expect(shouldKeepClickSuppressionAfterStop("pointer-cancel")).toBe(false);
    expect(shouldKeepClickSuppressionAfterStop("cleanup")).toBe(false);
  });

  it("blurs stage control buttons on pointer up to keep global hotkeys active", () => {
    const blur = vi.fn();

    blurStageControlButtonOnPointerUp({
      currentTarget: { blur } as unknown as HTMLButtonElement,
    });

    expect(blur).toHaveBeenCalledTimes(1);
  });
});
