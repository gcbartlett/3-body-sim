import { useEffect, useEffectEvent, useRef } from "react";
import {
  HOLD_ACCELERATION_TICK_MS,
  IDLE_STEP_ACCELERATION,
  repeatBurstForHoldDuration,
  type StepAccelerationDirection,
  type StepAccelerationState,
} from "./stepAcceleration";

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
  onStepAccelerationChange?: (next: StepAccelerationState) => void;
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

type StepBackBurstInput = {
  repeat: boolean;
  holdDurationMs: number;
};

export const stepBackBurstForHold = ({ repeat, holdDurationMs }: StepBackBurstInput): number => {
  if (!repeat) {
    return 1;
  }
  return repeatBurstForHoldDuration(holdDurationMs);
};

type DispatchSimulationHotkeyOptions = {
  canStepBack: boolean;
  stepForwardBurst?: number;
  stepBackBurst?: number;
};

export const dispatchSimulationHotkeyAction = (
  e: Pick<KeyboardEvent, "key" | "code" | "repeat" | "preventDefault">,
  handlers: HotkeyHandlers,
  { canStepBack, stepForwardBurst = 1, stepBackBurst = 1 }: DispatchSimulationHotkeyOptions,
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
    for (let i = 0; i < stepForwardBurst; ++i) {
      handlers.onStepForward();
    }
    return;
  }
  if (canStepBack && shouldStepBackFromHotkey(e)) {
    e.preventDefault();
    for (let i = 0; i < stepBackBurst; ++i) {
      handlers.onStepBack();
    }
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
  onStepAccelerationChange,
}: UseSimulationHotkeysParams) => {
  const holdStartedAtRef = useRef<number | null>(null);
  const holdIntervalIdRef = useRef<number | null>(null);
  const activeDirectionRef = useRef<StepAccelerationDirection | null>(null);

  const runBurstStep = useEffectEvent((direction: StepAccelerationDirection, burst: number) => {
    if (direction === "forward") {
      for (let i = 0; i < burst; ++i) {
        onStepForward();
      }
      return;
    }
    for (let i = 0; i < burst; ++i) {
      onStepBack();
    }
  });

  const emitAcceleration = useEffectEvent((next: StepAccelerationState) => {
    onStepAccelerationChange?.(next);
  });

  const stopStepHold = useEffectEvent(() => {
    if (holdIntervalIdRef.current !== null) {
      window.clearInterval(holdIntervalIdRef.current);
      holdIntervalIdRef.current = null;
    }
    holdStartedAtRef.current = null;
    activeDirectionRef.current = null;
    emitAcceleration(IDLE_STEP_ACCELERATION);
  });

  const startStepHold = useEffectEvent((direction: StepAccelerationDirection) => {
    if (direction === "backward" && !canStepBack) {
      return;
    }
    if (activeDirectionRef.current === direction) {
      return;
    }

    stopStepHold();
    activeDirectionRef.current = direction;
    holdStartedAtRef.current = performance.now();
    runBurstStep(direction, 1);
    emitAcceleration({
      source: "keyboard",
      direction,
      burst: 1,
      active: true,
    });

    holdIntervalIdRef.current = window.setInterval(() => {
      if (activeDirectionRef.current !== direction || holdStartedAtRef.current === null) {
        return;
      }
      if (direction === "backward" && !canStepBack) {
        stopStepHold();
        return;
      }
      const holdDurationMs = Math.max(0, performance.now() - holdStartedAtRef.current);
      const burst = repeatBurstForHoldDuration(holdDurationMs);
      if (burst === 0) {
        return;
      }
      runBurstStep(direction, burst);
      emitAcceleration({
        source: "keyboard",
        direction,
        burst,
        active: true,
      });
    }, HOLD_ACCELERATION_TICK_MS);
  });

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
      stopStepHold();
      onEscape();
      return;
    }
    if (shouldStepForwardFromHotkey(e)) {
      e.preventDefault();
      startStepHold("forward");
      return;
    }

    if (shouldStepBackFromHotkey(e)) {
      e.preventDefault();
      startStepHold("backward");
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
      {
        canStepBack,
      },
    );
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onKeyDownEvent(e);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && activeDirectionRef.current === "forward") {
        stopStepHold();
      }
      if (e.key === "ArrowLeft" && activeDirectionRef.current === "backward") {
        stopStepHold();
      }
    };
    const onWindowBlur = () => stopStepHold();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      stopStepHold();
    };
  }, []);
};
