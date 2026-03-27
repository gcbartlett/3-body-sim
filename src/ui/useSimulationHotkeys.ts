import { useEffect, useEffectEvent } from "react";

type UseSimulationHotkeysParams = {
  onEscape: () => void;
  onIncreaseRate: () => void;
  onDecreaseRate: () => void;
  onCycleLockMode: () => void;
  onTogglePause: () => void;
  onStepForward: () => void;
};

export const useSimulationHotkeys = ({
  onEscape,
  onIncreaseRate,
  onDecreaseRate,
  onCycleLockMode,
  onTogglePause,
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
    if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
      e.preventDefault();
      onIncreaseRate();
      return;
    }
    if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
      e.preventDefault();
      onDecreaseRate();
      return;
    }
    if (e.key === "l" || e.key === "L") {
      e.preventDefault();
      onCycleLockMode();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      onTogglePause();
      return;
    }
    if (e.key === "ArrowRight") {
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
