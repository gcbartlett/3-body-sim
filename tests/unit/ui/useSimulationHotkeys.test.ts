import { describe, expect, it } from "vitest";
import {
  shouldDecreaseRateFromHotkey,
  shouldCycleLockModeFromHotkey,
  shouldIncreaseRateFromHotkey,
  shouldStepForwardFromHotkey,
  shouldToggleCenterOfMassFromHotkey,
  shouldToggleGridFromHotkey,
  shouldToggleOriginMarkerFromHotkey,
  shouldTogglePauseFromHotkey,
} from "~/src/ui/useSimulationHotkeys";

describe("useSimulationHotkeys predicates", () => {
  it("treats Space/L/G/C/O as non-repeating hotkeys", () => {
    const nonRepeating = [
      { fn: shouldTogglePauseFromHotkey, code: "Space" },
      { fn: shouldCycleLockModeFromHotkey, code: "KeyL" },
      { fn: shouldToggleGridFromHotkey, code: "KeyG" },
      { fn: shouldToggleCenterOfMassFromHotkey, code: "KeyC" },
      { fn: shouldToggleOriginMarkerFromHotkey, code: "KeyO" },
    ] as const;

    for (const { fn, code } of nonRepeating) {
      expect(fn({ code, repeat: false })).toBe(true);
      expect(fn({ code, repeat: true })).toBe(false);
    }
  });

  it("allows repeat for +, -, and Right Arrow hotkeys", () => {
    expect(shouldIncreaseRateFromHotkey({ key: "+", code: "Equal", repeat: false })).toBe(true);
    expect(shouldIncreaseRateFromHotkey({ key: "+", code: "Equal", repeat: true })).toBe(true);
    expect(shouldIncreaseRateFromHotkey({ key: "=", code: "Equal", repeat: true })).toBe(true);
    expect(shouldIncreaseRateFromHotkey({ key: "", code: "NumpadAdd", repeat: true })).toBe(true);

    expect(shouldDecreaseRateFromHotkey({ key: "-", code: "Minus", repeat: false })).toBe(true);
    expect(shouldDecreaseRateFromHotkey({ key: "-", code: "Minus", repeat: true })).toBe(true);
    expect(shouldDecreaseRateFromHotkey({ key: "_", code: "Minus", repeat: true })).toBe(true);
    expect(shouldDecreaseRateFromHotkey({ key: "", code: "NumpadSubtract", repeat: true })).toBe(true);

    expect(shouldStepForwardFromHotkey({ key: "ArrowRight", code: "ArrowRight", repeat: false })).toBe(true);
    expect(shouldStepForwardFromHotkey({ key: "ArrowRight", code: "ArrowRight", repeat: true })).toBe(true);
  });
});
