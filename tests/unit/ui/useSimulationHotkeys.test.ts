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
  it("treats Space and letter toggles as non-repeating hotkeys", () => {
    expect(shouldTogglePauseFromHotkey({ code: "Space", repeat: false })).toBe(true);
    expect(shouldTogglePauseFromHotkey({ code: "Space", repeat: true })).toBe(false);

    expect(shouldCycleLockModeFromHotkey({ key: "l", repeat: false })).toBe(true);
    expect(shouldCycleLockModeFromHotkey({ key: "L", repeat: false })).toBe(true);
    expect(shouldCycleLockModeFromHotkey({ key: "l", repeat: true })).toBe(false);

    expect(shouldToggleGridFromHotkey({ key: "g", repeat: false })).toBe(true);
    expect(shouldToggleGridFromHotkey({ key: "G", repeat: false })).toBe(true);
    expect(shouldToggleGridFromHotkey({ key: "g", repeat: true })).toBe(false);

    expect(shouldToggleCenterOfMassFromHotkey({ key: "c", repeat: false })).toBe(true);
    expect(shouldToggleCenterOfMassFromHotkey({ key: "C", repeat: false })).toBe(true);
    expect(shouldToggleCenterOfMassFromHotkey({ key: "c", repeat: true })).toBe(false);

    expect(shouldToggleOriginMarkerFromHotkey({ key: "o", repeat: false })).toBe(true);
    expect(shouldToggleOriginMarkerFromHotkey({ key: "O", repeat: false })).toBe(true);
    expect(shouldToggleOriginMarkerFromHotkey({ key: "o", repeat: true })).toBe(false);
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
