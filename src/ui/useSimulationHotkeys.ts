import { useEffect, useRef } from "react";

type LockMode = "none" | "com" | "origin";

type UseSimulationHotkeysParams = {
  lockMode: LockMode;
  onEscape: () => void;
  onIncreaseRate: () => void;
  onDecreaseRate: () => void;
  onCycleLockMode: () => void;
};

export const useSimulationHotkeys = ({
  lockMode,
  onEscape,
  onIncreaseRate,
  onDecreaseRate,
  onCycleLockMode,
}: UseSimulationHotkeysParams) => {
  const onEscapeRef = useRef(onEscape);
  const onIncreaseRateRef = useRef(onIncreaseRate);
  const onDecreaseRateRef = useRef(onDecreaseRate);
  const onCycleLockModeRef = useRef(onCycleLockMode);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    onIncreaseRateRef.current = onIncreaseRate;
    onDecreaseRateRef.current = onDecreaseRate;
    onCycleLockModeRef.current = onCycleLockMode;
  }, [onCycleLockMode, onDecreaseRate, onEscape, onIncreaseRate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
        onEscapeRef.current();
        return;
      }
      if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
        e.preventDefault();
        onIncreaseRateRef.current();
        return;
      }
      if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
        e.preventDefault();
        onDecreaseRateRef.current();
        return;
      }
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        onCycleLockModeRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockMode]);
};
