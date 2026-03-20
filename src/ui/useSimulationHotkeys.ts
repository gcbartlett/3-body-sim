import { useEffect, useEffectEvent } from "react";

type UseSimulationHotkeysParams = {
  onEscape: () => void;
  onIncreaseRate: () => void;
  onDecreaseRate: () => void;
  onCycleLockMode: () => void;
};

export const useSimulationHotkeys = ({
  onEscape,
  onIncreaseRate,
  onDecreaseRate,
  onCycleLockMode,
}: UseSimulationHotkeysParams) => {
  const onKeyDownEvent = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isEditable =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      Boolean(target?.isContentEditable);
    if (isEditable) {
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
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onKeyDownEvent(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
