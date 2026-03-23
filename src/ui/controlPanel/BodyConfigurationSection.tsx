import { useRef } from "react";
import type { BodyState } from "../../sim/types";
import { decimalPlaces } from "./numberInputPrecision";
import { StepperNumberInput } from "./StepperNumberInput";
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
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const rowsPerBody = bodyConfigRows.length;

  const focusBodyFieldInput = (bodyIndex: number, rowIndex: number) => {
    inputRefs.current[`${bodyIndex}:${rowIndex}`]?.focus();
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
                const value = fieldValue(body, row.field);
                const linearIndex = index * rowsPerBody + rowIndex;
                const total = bodies.length * rowsPerBody;

                return (
                  <StepperNumberInput
                    key={`${body.id}-${row.field}`}
                    value={value}
                    formattedValue={formatBodyInputValue(value, displayPrecision[row.precisionGroup])}
                    color={body.color}
                    tooltip={row.tooltip}
                    label={row.label}
                    step={row.step}
                    min={row.min}
                    bodyIndex={index}
                    inputRef={(element) => {
                      inputRefs.current[`${index}:${rowIndex}`] = element;
                    }}
                    onValueChange={(nextValue) => {
                      onBodyChange(index, row.field, nextValue);
                    }}
                    onTabNavigate={(shift) => {
                      const nextLinearIndex = shift ? linearIndex - 1 : linearIndex + 1;
                      if (nextLinearIndex < 0 || nextLinearIndex >= total) return false;
                      const nextBodyIndex = Math.floor(nextLinearIndex / rowsPerBody);
                      const nextRowIndex = nextLinearIndex % rowsPerBody;
                      focusBodyFieldInput(nextBodyIndex, nextRowIndex);
                      return true;
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
};
