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
  onStepBack: () => void;
  canStepBack: boolean;
};

type KeyboardHotkeyEvent = Pick<KeyboardEvent, "key" | "code" | "repeat">;

const isNonRepeatingCodeHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
  code: KeyboardEvent["code"],
): boolean => e.code === code && !e.repeat;

const isNonRepeatingLetterHotkey = (
  e: Pick<KeyboardEvent, "key" | "repeat">,
  letter: string,
): boolean => e.key.toLowerCase() === letter && !e.repeat;

export const shouldTogglePauseFromHotkey = (
  e: Pick<KeyboardEvent, "code" | "repeat">,
): boolean => isNonRepeatingCodeHotkey(e, "Space");

export const shouldCycleLockModeFromHotkey = (
  e: Pick<KeyboardEvent, "key" | "repeat">,
): boolean => isNonRepeatingLetterHotkey(e, "l");

export const shouldToggleGridFromHotkey = (
  e: Pick<KeyboardEvent, "key" | "repeat">,
): boolean => isNonRepeatingLetterHotkey(e, "g");

export const shouldToggleCenterOfMassFromHotkey = (
  e: Pick<KeyboardEvent, "key" | "repeat">,
): boolean => isNonRepeatingLetterHotkey(e, "c");

export const shouldToggleOriginMarkerFromHotkey = (
  e: Pick<KeyboardEvent, "key" | "repeat">,
): boolean => isNonRepeatingLetterHotkey(e, "o");

export const shouldIncreaseRateFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "+" || e.key === "=" || e.code === "NumpadAdd";

export const shouldDecreaseRateFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";

export const shouldStepForwardFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "ArrowRight";

export const shouldStepBackFromHotkey = (e: KeyboardHotkeyEvent): boolean =>
  e.key === "ArrowLeft";

type HotkeyHandlers = Omit<UseSimulationHotkeysParams, "canStepBack">;

export const dispatchSimulationHotkeyAction = (
  e: Pick<KeyboardEvent, "key" | "code" | "repeat" | "preventDefault">,
  handlers: HotkeyHandlers,
  canStepBack: boolean,
): void => {
  if (shouldIncreaseRateFromHotkey(e)) {
    e.preventDefault();
    handlers.onIncreaseRate();
    return;
  }
  if (shouldDecreaseRateFromHotkey(e)) {
    e.preventDefault();
    handlers.onDecreaseRate();
    return;
  }
  if (shouldCycleLockModeFromHotkey(e)) {
    e.preventDefault();
    handlers.onCycleLockMode();
    return;
  }
  if (shouldTogglePauseFromHotkey(e)) {
    e.preventDefault();
    handlers.onTogglePause();
    return;
  }
  if (shouldToggleGridFromHotkey(e)) {
    e.preventDefault();
    handlers.onToggleGrid();
    return;
  }
  if (shouldToggleCenterOfMassFromHotkey(e)) {
    e.preventDefault();
    handlers.onToggleCenterOfMass();
    return;
  }
  if (shouldToggleOriginMarkerFromHotkey(e)) {
    e.preventDefault();
    handlers.onToggleOriginMarker();
    return;
  }
  if (shouldStepForwardFromHotkey(e)) {
    e.preventDefault();
    handlers.onStepForward();
    return;
  }
  if (canStepBack && shouldStepBackFromHotkey(e)) {
    e.preventDefault();
    handlers.onStepBack();
  }
};

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
  onStepBack,
  canStepBack,
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
    dispatchSimulationHotkeyAction(
      e,
      {
        onEscape,
        onIncreaseRate,
        onDecreaseRate,
        onCycleLockMode,
        onTogglePause,
        onToggleGrid,
        onToggleCenterOfMass,
        onToggleOriginMarker,
        onStepForward,
        onStepBack,
      },
      canStepBack,
    );
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onKeyDownEvent(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
