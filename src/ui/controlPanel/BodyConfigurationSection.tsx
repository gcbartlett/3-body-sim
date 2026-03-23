import { useState } from "react";
import type { BodyState } from "../../sim/types";
import type { BodyConfigField } from "./types";

type BodyConfigRow = {
  label: string;
  field: BodyConfigField;
  precisionGroup: "mass" | "position" | "velocity";
  step: number;
  min?: number;
  tooltip: string;
};

type Props = {
  bodies: BodyState[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBodyChange: (index: number, field: BodyConfigField, value: number) => void;
};

const bodyConfigRows: BodyConfigRow[] = [
  {
    label: "Mass:",
    field: "mass",
    precisionGroup: "mass",
    step: 1,
    min: 0.1,
    tooltip: "Mass of the body used in gravitational force calculations.",
  },
  {
    label: "Position X:",
    field: "position.x",
    precisionGroup: "position",
    step: 0.05,
    tooltip: "Initial x-coordinate in world units.",
  },
  {
    label: "Position Y:",
    field: "position.y",
    precisionGroup: "position",
    step: 0.05,
    tooltip: "Initial y-coordinate in world units.",
  },
  {
    label: "Velocity X:",
    field: "velocity.x",
    precisionGroup: "velocity",
    step: 0.05,
    tooltip: "Initial x-velocity in world-units per second.",
  },
  {
    label: "Velocity Y:",
    field: "velocity.y",
    precisionGroup: "velocity",
    step: 0.05,
    tooltip: "Initial y-velocity in world-units per second.",
  },
];

const MAX_DISPLAY_DECIMALS = 12;

const decimalPlaces = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  const normalized = Math.abs(value).toString().toLowerCase();
  if (normalized.includes("e")) {
    const [mantissa, exponentText] = normalized.split("e");
    const exponent = Number.parseInt(exponentText ?? "0", 10);
    const mantissaDecimals = (mantissa.split(".")[1] ?? "").length;
    return Math.max(0, Math.min(MAX_DISPLAY_DECIMALS, mantissaDecimals - exponent));
  }
  return Math.min(MAX_DISPLAY_DECIMALS, (normalized.split(".")[1] ?? "").length);
};

const maxPrecision = (values: number[]) => values.reduce((max, value) => Math.max(max, decimalPlaces(value)), 0);

const precisionByGroup = (bodies: BodyState[]) => {
  const massPrecision = maxPrecision(bodies.map((body) => body.mass));
  const positionPrecision = maxPrecision(bodies.flatMap((body) => [body.position.x, body.position.y]));
  const velocityPrecision = maxPrecision(bodies.flatMap((body) => [body.velocity.x, body.velocity.y]));

  return {
    mass: massPrecision,
    position: positionPrecision,
    velocity: velocityPrecision,
  };
};

const formatBodyInputValue = (value: number, decimals: number) => value.toFixed(decimals);

const fieldValue = (body: BodyState, field: BodyConfigField) => {
  if (field === "mass") return body.mass;
  if (field === "position.x") return body.position.x;
  if (field === "position.y") return body.position.y;
  if (field === "velocity.x") return body.velocity.x;
  return body.velocity.y;
};

export const BodyConfigurationSection = ({ bodies, open, onOpenChange, onBodyChange }: Props) => {
  const displayPrecision = precisionByGroup(bodies);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const isFiniteNumber = (value: number) => Number.isFinite(value);
  const roundToStepPrecision = (value: number, step: number) => {
    const stepPrecision = Math.min(MAX_DISPLAY_DECIMALS, decimalPlaces(step));
    return Number(value.toFixed(stepPrecision));
  };
  const focusBodyFieldInput = (bodyIndex: number, rowIndex: number) => {
    const selector = `input[data-body-index="${bodyIndex}"][data-row-index="${rowIndex}"]`;
    const target = document.querySelector<HTMLInputElement>(selector);
    target?.focus();
  };

  return (
    <section>
      <details
        open={open}
        onToggle={(e) => {
          onOpenChange(e.currentTarget.open);
        }}
      >
        <summary className="collapsible-summary">Initial Body Configuration</summary>
        <div className="body-config-matrix">
          <div className="body-config-header body-config-label-header">Parameter</div>
          {bodies.map((body, index) => (
            <div
              key={`header-${body.id}`}
              className="body-config-header"
              style={{ color: body.color }}
              title="Column for this body's initial conditions."
            >
              Body {index + 1}
            </div>
          ))}

          {bodyConfigRows.map((row, rowIndex) => (
            <div key={`row-${row.field}`} className="body-config-row">
              <div className="body-config-label" title={row.tooltip}>
                {row.label}
              </div>
              {bodies.map((body, index) => {
                const key = `${body.id}:${row.field}`;
                const value = fieldValue(body, row.field);
                const isFocused = focusedKey === key;
                const displayValue = isFocused
                  ? (draftValues[key] ?? String(value))
                  : formatBodyInputValue(value, displayPrecision[row.precisionGroup]);
                const applyDelta = (direction: 1 | -1) => {
                  const raw = draftValues[key];
                  const parsedDraft = raw === undefined ? Number.NaN : Number(raw);
                  const base = isFiniteNumber(parsedDraft) ? parsedDraft : value;
                  const next = roundToStepPrecision(base + direction * row.step, row.step);
                  const clamped = row.min === undefined ? next : Math.max(row.min, next);
                  const nextText = String(clamped);
                  setDraftValues((prev) => ({ ...prev, [key]: nextText }));
                  onBodyChange(index, row.field, clamped);
                };

                return (
                  <div key={`${body.id}-${row.field}`} className="body-config-cell">
                    <input
                      className="body-input"
                      style={{ color: body.color, borderColor: body.color }}
                      title={row.tooltip}
                      type="text"
                      data-body-index={index}
                      data-row-index={rowIndex}
                      inputMode="decimal"
                      pattern="[0-9eE+\\-.]*"
                      value={displayValue}
                      onDoubleClick={(e) => {
                        e.currentTarget.select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
                        const rowsPerBody = bodyConfigRows.length;
                        const total = bodies.length * rowsPerBody;
                        const linearIndex = index * rowsPerBody + rowIndex;
                        const nextLinearIndex = e.shiftKey ? linearIndex - 1 : linearIndex + 1;
                        if (nextLinearIndex < 0 || nextLinearIndex >= total) return;
                        e.preventDefault();
                        const nextBodyIndex = Math.floor(nextLinearIndex / rowsPerBody);
                        const nextRowIndex = nextLinearIndex % rowsPerBody;
                        focusBodyFieldInput(nextBodyIndex, nextRowIndex);
                      }}
                      onFocus={(e) => {
                        const nextValue = e.currentTarget.value;
                        setFocusedKey(key);
                        setDraftValues((prev) => ({ ...prev, [key]: nextValue }));
                      }}
                      onBlur={() => {
                        setFocusedKey((prev) => (prev === key ? null : prev));
                        setDraftValues((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setDraftValues((prev) => ({ ...prev, [key]: nextValue }));
                        const parsedValue = Number(nextValue);
                        if (isFiniteNumber(parsedValue)) {
                          onBodyChange(index, row.field, parsedValue);
                        }
                      }}
                    />
                    <div className="body-stepper" style={{ color: body.color, borderColor: body.color }} aria-hidden="true">
                      <button
                        type="button"
                        className="body-stepper-button body-stepper-up"
                        aria-label={`Increase ${row.label} for body ${index + 1}`}
                        title={`Increase ${row.label}`}
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyDelta(1)}
                      />
                      <button
                        type="button"
                        className="body-stepper-button body-stepper-down"
                        aria-label={`Decrease ${row.label} for body ${index + 1}`}
                        title={`Decrease ${row.label}`}
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyDelta(-1)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
};
