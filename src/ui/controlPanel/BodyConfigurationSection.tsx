import type { BodyState } from "../../sim/types";
import type { BodyConfigField } from "./types";

type BodyConfigRow = {
  label: string;
  field: BodyConfigField;
  step: string;
  min?: string;
  tooltip: string;
};

type Props = {
  bodies: BodyState[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBodyChange: (index: number, field: BodyConfigField, value: number) => void;
};

const bodyConfigRows: BodyConfigRow[] = [
  { label: "Mass", field: "mass", step: "0.1", min: "0.1", tooltip: "Mass of the body used in gravitational force calculations." },
  { label: "Position X", field: "position.x", step: "0.05", tooltip: "Initial x-coordinate in world units." },
  { label: "Position Y", field: "position.y", step: "0.05", tooltip: "Initial y-coordinate in world units." },
  { label: "Velocity X", field: "velocity.x", step: "0.05", tooltip: "Initial x-velocity in world-units per second." },
  { label: "Velocity Y", field: "velocity.y", step: "0.05", tooltip: "Initial y-velocity in world-units per second." },
];

const number = (value: number) => (Number.isFinite(value) ? value : 0);

const formatBodyInputValue = (value: number) => Number(value.toFixed(3));

const fieldValue = (body: BodyState, field: BodyConfigField) => {
  if (field === "mass") return body.mass;
  if (field === "position.x") return body.position.x;
  if (field === "position.y") return body.position.y;
  if (field === "velocity.x") return body.velocity.x;
  return body.velocity.y;
};

export const BodyConfigurationSection = ({ bodies, open, onOpenChange, onBodyChange }: Props) => (
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

        {bodyConfigRows.map((row) => (
          <div key={`row-${row.field}`} className="body-config-row">
            <div className="body-config-label" title={row.tooltip}>
              {row.label}
            </div>
            {bodies.map((body, index) => (
              <div key={`${body.id}-${row.field}`} className="body-config-cell">
                <input
                  className="body-input"
                  style={{ color: body.color, borderColor: body.color }}
                  title={row.tooltip}
                  type="number"
                  step={row.step}
                  min={row.min}
                  value={formatBodyInputValue(fieldValue(body, row.field))}
                  onChange={(e) => onBodyChange(index, row.field, number(e.target.valueAsNumber))}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  </section>
);
