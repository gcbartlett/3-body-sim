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

    expect(html).toContain(">Back</button>");
    expect(html).toContain("disabled");
    expect(html).toContain("Hotkey: Left Arrow.");
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

    expect(html).toContain(">Back</button>");
    expect(html).not.toContain("disabled");
  });
});
