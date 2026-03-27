import { useEffect, useEffectEvent } from "react";

type UseSimulationHotkeysParams = {
  onEscape: () => void;
  onIncreaseRate: () => void;
  onDecreaseRate: () => void;
  onCycleLockMode: () => void;
  onTogglePause: () => void;
  onToggleGrid: () => void;
  onToggleCenterOfMass: () => void;
  onToggleOriginMarker: () => void;
  onStepForward: () => void;
};

type KeyboardHotkeyEvent = Pick<KeyboardEvent, "key" | "code" | "repeat">;

const isNonRepeatingCodeHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
  code: KeyboardEvent["code"],
): boolean => e.code === code && !e.repeat;

export const shouldTogglePauseFromHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
): boolean => isNonRepeatingCodeHotkey(e, "Space");

export const shouldCycleLockModeFromHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
): boolean => isNonRepeatingCodeHotkey(e, "KeyL");

export const shouldToggleGridFromHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
): boolean => isNonRepeatingCodeHotkey(e, "KeyG");

export const shouldToggleCenterOfMassFromHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
): boolean => isNonRepeatingCodeHotkey(e, "KeyC");

export const shouldToggleOriginMarkerFromHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
): boolean => isNonRepeatingCodeHotkey(e, "KeyO");

export const shouldIncreaseRateFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "+" || e.key === "=" || e.code === "NumpadAdd";

export const shouldDecreaseRateFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";

export const shouldStepForwardFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "ArrowRight";

export const useSimulationHotkeys = ({
  onEscape,
  onIncreaseRate,
  onDecreaseRate,
  onCycleLockMode,
  onTogglePause,
  onToggleGrid,
  onToggleCenterOfMass,
  onToggleOriginMarker,
  onStepForward,
}: UseSimulationHotkeysParams) => {
  const onKeyDownEvent = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    const target = e.target as HTMLElement | null;
    const isEditable =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      Boolean(target?.isContentEditable);
    const isInteractive = Boolean(
      target?.closest("button, a[href], [role='button'], [role='link']"),
    );
    if (isEditable || isInteractive) {
      return;
    }

    if (e.key === "Escape") {
      onEscape();
      return;
    }
    if (shouldIncreaseRateFromHotkey(e)) {
      e.preventDefault();
      onIncreaseRate();
      return;
    }
    if (shouldDecreaseRateFromHotkey(e)) {
      e.preventDefault();
      onDecreaseRate();
      return;
    }
    if (shouldCycleLockModeFromHotkey(e)) {
      e.preventDefault();
      onCycleLockMode();
      return;
    }
    if (shouldTogglePauseFromHotkey(e)) {
      e.preventDefault();
      onTogglePause();
      return;
    }
    if (shouldToggleGridFromHotkey(e)) {
      e.preventDefault();
      onToggleGrid();
      return;
    }
    if (shouldToggleCenterOfMassFromHotkey(e)) {
      e.preventDefault();
      onToggleCenterOfMass();
      return;
    }
    if (shouldToggleOriginMarkerFromHotkey(e)) {
      e.preventDefault();
      onToggleOriginMarker();
      return;
    }
    if (shouldStepForwardFromHotkey(e)) {
      e.preventDefault();
      onStepForward();
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onKeyDownEvent(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
