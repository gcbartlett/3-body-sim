import { useState } from "react";
import { decimalPlaces, MAX_DISPLAY_DECIMALS } from "./numberInputPrecision";

type Props = {
  value: number;
  formattedValue: string;
  color: string;
  tooltip: string;
  label: string;
  step: number;
  min?: number;
  bodyIndex: number;
  inputRef?: (element: HTMLInputElement | null) => void;
  onValueChange: (value: number) => void;
  onTabNavigate?: (shift: boolean) => boolean;
};

const roundToStepPrecision = (value: number, step: number) => {
  const stepPrecision = Math.min(MAX_DISPLAY_DECIMALS, decimalPlaces(step));
  return Number(value.toFixed(stepPrecision));
};

const isFiniteNumber = (value: number) => Number.isFinite(value);

export const StepperNumberInput = ({
  value,
  formattedValue,
  color,
  tooltip,
  label,
  step,
  min,
  bodyIndex,
  inputRef,
  onValueChange,
  onTabNavigate,
}: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const displayValue = isFocused ? (draftValue ?? String(value)) : formattedValue;
  const baseLabel = label.endsWith(":") ? label.slice(0, -1) : label;

  const applyDelta = (direction: 1 | -1) => {
    const parsedDraft = draftValue === null ? Number.NaN : Number(draftValue);
    const base = isFiniteNumber(parsedDraft) ? parsedDraft : value;
    const next = roundToStepPrecision(base + direction * step, step);
    const clamped = min === undefined ? next : Math.max(min, next);
    const nextText = String(clamped);
    setDraftValue(nextText);
    onValueChange(clamped);
  };

  return (
    <div className="body-config-cell">
      <input
        ref={inputRef}
        className="body-input"
        style={{ color, borderColor: color }}
        title={tooltip}
        type="text"
        inputMode="decimal"
        pattern="[0-9eE+\\-.]*"
        value={displayValue}
        onDoubleClick={(e) => {
          e.currentTarget.select();
        }}
        onKeyDown={(e) => {
          if (!onTabNavigate || e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
          const handled = onTabNavigate(e.shiftKey);
          if (handled) {
            e.preventDefault();
          }
        }}
        onFocus={(e) => {
          setIsFocused(true);
          setDraftValue(e.currentTarget.value);
          if (e.currentTarget.matches(":focus-visible")) {
            e.currentTarget.select();
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          setDraftValue(null);
        }}
        onChange={(e) => {
          const nextValue = e.target.value;
          setDraftValue(nextValue);
          const parsedValue = Number(nextValue);
          if (isFiniteNumber(parsedValue)) onValueChange(parsedValue);
        }}
      />
      <div className="body-stepper" style={{ color, borderColor: color }} aria-hidden="true">
        <button
          type="button"
          className="body-stepper-button body-stepper-up"
          aria-label={`Increase ${baseLabel} for body ${bodyIndex + 1}`}
          title={`Increase ${baseLabel}`}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyDelta(1)}
        />
        <button
          type="button"
          className="body-stepper-button body-stepper-down"
          aria-label={`Decrease ${baseLabel} for body ${bodyIndex + 1}`}
          title={`Decrease ${baseLabel}`}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyDelta(-1)}
        />
      </div>
    </div>
  );
};
