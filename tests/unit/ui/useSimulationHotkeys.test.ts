import { describe, expect, it, vi } from "vitest";
import {
  dispatchSimulationHotkeyAction,
  shouldDecreaseRateFromHotkey,
  shouldCycleLockModeFromHotkey,
  shouldIncreaseRateFromHotkey,
  shouldStepBackFromHotkey,
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

  it("allows repeat for +, -, and arrow-step hotkeys", () => {
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
    expect(shouldStepBackFromHotkey({ key: "ArrowLeft", code: "ArrowLeft", repeat: false })).toBe(true);
    expect(shouldStepBackFromHotkey({ key: "ArrowLeft", code: "ArrowLeft", repeat: true })).toBe(true);
  });
});

describe("dispatchSimulationHotkeyAction", () => {
  const createHandlers = () => ({
    onEscape: vi.fn(),
    onIncreaseRate: vi.fn(),
    onDecreaseRate: vi.fn(),
    onCycleLockMode: vi.fn(),
    onTogglePause: vi.fn(),
    onToggleGrid: vi.fn(),
    onToggleCenterOfMass: vi.fn(),
    onToggleOriginMarker: vi.fn(),
    onStepForward: vi.fn(),
    onStepBack: vi.fn(),
  });

  it("dispatches ArrowLeft to onStepBack when canStepBack is true", () => {
    const handlers = createHandlers();
    const preventDefault = vi.fn();

    dispatchSimulationHotkeyAction(
      { key: "ArrowLeft", code: "ArrowLeft", repeat: false, preventDefault },
      handlers,
      true,
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(handlers.onStepBack).toHaveBeenCalledTimes(1);
    expect(handlers.onTogglePause).not.toHaveBeenCalled();
  });

  it("does not dispatch ArrowLeft when canStepBack is false", () => {
    const handlers = createHandlers();
    const preventDefault = vi.fn();

    dispatchSimulationHotkeyAction(
      { key: "ArrowLeft", code: "ArrowLeft", repeat: false, preventDefault },
      handlers,
      false,
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(handlers.onStepBack).not.toHaveBeenCalled();
    expect(handlers.onTogglePause).not.toHaveBeenCalled();
  });

  it("keeps running-state hotkey path atomic by invoking step-back, not pause", () => {
    const handlers = createHandlers();
    const preventDefault = vi.fn();

    dispatchSimulationHotkeyAction(
      { key: "ArrowLeft", code: "ArrowLeft", repeat: true, preventDefault },
      handlers,
      true,
    );

    expect(handlers.onStepBack).toHaveBeenCalledTimes(1);
    expect(handlers.onTogglePause).not.toHaveBeenCalled();
  });
});
