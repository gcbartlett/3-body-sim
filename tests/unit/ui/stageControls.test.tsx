import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StageControls } from "~/src/ui/stage/StageControls";

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
  });
});
